package com.weiwei.blog.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Boots the real Spring context against an in-memory H2 database and drives the real HTTP layer.
 *
 * <p>No Docker, MySQL or MinIO is required: Flyway is switched off, Hibernate creates the schema
 * from the entities, and the S3 beans construct without connecting to anything. This is the only
 * place these code paths are executed, so it is what actually proves register/login issue a usable
 * token and that one account cannot reach another account's rows.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:weiwei-blog-test;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "app.jwt-secret=integration-test-secret-value-of-at-least-32-bytes",
        "app.cors-origin=http://localhost:5173",
        "app.storage.endpoint=http://localhost:9000",
        "app.storage.region=us-east-1",
        "app.storage.bucket=test-bucket",
        "app.storage.access-key=test-access-key",
        "app.storage.secret-key=test-secret-key",
})
class BlogApiIntegrationTest {

    private static final Pattern ACCESS_TOKEN = Pattern.compile("\"accessToken\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern ID = Pattern.compile("\"id\"\\s*:\\s*(\\d+)");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JwtEncoder jwtEncoder;

    // ---------------------------------------------------------------- helpers

    private String register(String email, String password, String displayName) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s","displayName":"%s"}""".formatted(email, password, displayName)))
                .andExpect(status().isOk())
                .andReturn();
        return tokenOf(result);
    }

    private String tokenOf(MvcResult result) throws Exception {
        Matcher matcher = ACCESS_TOKEN.matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).as("response should contain an accessToken").isTrue();
        return matcher.group(1);
    }

    /** Reads the generated id without depending on Jackson's package, which changed in Boot 4. */
    private String idOf(MvcResult result) throws Exception {
        Matcher matcher = ID.matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).as("response should contain a numeric id").isTrue();
        return matcher.group(1);
    }

    private String uniqueEmail(String prefix) {
        return prefix + "-" + java.util.UUID.randomUUID() + "@example.com";
    }

    private static final String PASSWORD = "a-long-enough-password";

    // ---------------------------------------------------------------- auth / JWT

    @Test
    void registerIssuesAToken() throws Exception {
        // Fails with 500 if the JWS header is left implicit: the encoder's default is RS256 while
        // this service signs with an HMAC secret, so no signing key can be selected.
        MvcResult result = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s","displayName":"唯唯"}""".formatted(uniqueEmail("register"), PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.displayName").value("唯唯"))
                .andReturn();
        assertThat(tokenOf(result)).isNotBlank();
    }

    @Test
    void loginReturnsATokenThatUnlocksTheAccount() throws Exception {
        String email = uniqueEmail("login");
        register(email, PASSWORD, "唯唯");

        MvcResult login = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}""".formatted(email, PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();
        String token = tokenOf(login);

        // The decoder must accept what the encoder produced, including the issuer check.
        mvc.perform(get("/api/account/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.displayName").value("唯唯"))
                .andExpect(jsonPath("$.bio").exists());
    }

    @Test
    void loginWithTheWrongPasswordIsUnauthorized() throws Exception {
        String email = uniqueEmail("wrongpass");
        register(email, PASSWORD, "唯唯");

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"definitely-not-the-password"}""".formatted(email)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void registeringTheSameEmailTwiceConflicts() throws Exception {
        String email = uniqueEmail("duplicate");
        register(email, PASSWORD, "唯唯");

        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s","displayName":"唯唯"}""".formatted(email, PASSWORD)))
                .andExpect(status().isConflict());
    }

    @Test
    void protectedEndpointsRejectAnAnonymousCaller() throws Exception {
        mvc.perform(get("/api/diaries")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/articles")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/media")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/account/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void aTokenFromAnotherIssuerIsRejected() throws Exception {
        // Same signing key, different issuer: only the issuer check can catch this.
        String foreign = jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(),
                JwtClaimsSet.builder()
                        .issuer("some-other-service")
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plus(1, ChronoUnit.HOURS))
                        .subject("1")
                        .build())).getTokenValue();

        mvc.perform(get("/api/diaries").header("Authorization", "Bearer " + foreign))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aTokenSignedWithADifferentSecretIsRejected() throws Exception {
        SecretKey rogueKey = new SecretKeySpec(
                "a-totally-different-secret-key-of-32-bytes!".getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        JwtEncoder rogue = new NimbusJwtEncoder(new ImmutableSecret<>(rogueKey));
        String forged = rogue.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(),
                JwtClaimsSet.builder()
                        .issuer("weiwei-blog")
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plus(1, ChronoUnit.HOURS))
                        .subject("1")
                        .build())).getTokenValue();

        mvc.perform(get("/api/diaries").header("Authorization", "Bearer " + forged))
                .andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------------------------- per-account isolation

    @Test
    void oneAccountCannotReachAnotherAccountsDiary() throws Exception {
        String ownerToken = register(uniqueEmail("owner"), PASSWORD, "Owner");
        String intruderToken = register(uniqueEmail("intruder"), PASSWORD, "Intruder");

        MvcResult created = mvc.perform(post("/api/diaries")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"私密的一天","entryDate":"2026-09-30","mood":"平静","weather":"☀️",
                                 "visibility":"PRIVATE","tags":"日常","content":"只有我能看到。"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.entryDate").value("2026-09-30"))
                .andReturn();
        String id = idOf(created);

        // The intruder sees an empty library and cannot read, or delete, the other account's row.
        mvc.perform(get("/api/diaries").header("Authorization", "Bearer " + intruderToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/diaries/" + id).header("Authorization", "Bearer " + intruderToken))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/diaries/" + id).header("Authorization", "Bearer " + intruderToken))
                .andExpect(status().isNotFound());

        // The owner still sees it.
        mvc.perform(get("/api/diaries").header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void thePublicDiaryFeedOnlyExposesPublicEntries() throws Exception {
        String token = register(uniqueEmail("publicfeed"), PASSWORD, "Owner");

        mvc.perform(post("/api/diaries")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"公开的一天","entryDate":"2026-09-29","mood":"开心","weather":"☀️",
                                 "visibility":"PUBLIC","tags":"旅行,海边","content":"给访客看。"}"""))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/diaries")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"只给自己","entryDate":"2026-09-28","mood":"平静","weather":"🌧",
                                 "visibility":"PRIVATE","tags":"随想","content":"不公开。"}"""))
                .andExpect(status().isCreated());

        // Anonymous, so this also proves /api/public/** is reachable without a token.
        mvc.perform(get("/api/public/diaries"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("公开的一天"))
                .andExpect(jsonPath("$[0].visibility").value("PUBLIC"))
                // Field names the frontend's mapDiary() reads.
                .andExpect(jsonPath("$[0].entryDate").exists())
                .andExpect(jsonPath("$[0].weather").exists())
                .andExpect(jsonPath("$[0].mood").exists())
                .andExpect(jsonPath("$[0].tags").exists())
                .andExpect(jsonPath("$[0].content").exists());
    }

    // ---------------------------------------------------------------- articles + validation

    @Test
    void articlesRoundTripWithTheFieldNamesTheFrontendReads() throws Exception {
        String token = register(uniqueEmail("articles"), PASSWORD, "Owner");

        mvc.perform(post("/api/articles")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"把生活调成喜欢的亮度","category":"慢生活","visibility":"PUBLIC",
                                 "tags":"日常,慢生活","excerpt":"给自己一段没有安排的下午。","content":"正文内容。",
                                 "coverUrl":"","articleDate":"2026-09-18"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.articleDate").value("2026-09-18"))
                .andExpect(jsonPath("$.coverUrl").exists());

        mvc.perform(get("/api/public/articles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("把生活调成喜欢的亮度"))
                .andExpect(jsonPath("$[0].category").value("慢生活"))
                .andExpect(jsonPath("$[0].excerpt").exists());
    }

    @Test
    void anInvalidArticleDateIsRejectedRatherThanStoredAsGarbage() throws Exception {
        String token = register(uniqueEmail("baddate"), PASSWORD, "Owner");

        mvc.perform(post("/api/articles")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"日期不合法","category":"日常","visibility":"PUBLIC","tags":"日常",
                                 "excerpt":"","content":"正文","coverUrl":"","articleDate":"2026/09/18"}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aTooShortPasswordIsRejected() throws Exception {
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"short","displayName":"唯唯"}""".formatted(uniqueEmail("shortpass"))))
                .andExpect(status().isBadRequest());
    }
}
