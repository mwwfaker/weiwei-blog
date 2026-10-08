FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 appuser
COPY --from=build /src/target/weiwei-blog-api-0.1.0.jar /app/app.jar
USER 10001
EXPOSE 8080
# JAVA_OPTS 可以用环境变量覆盖：给内存只有 256 MB 的免费实例压一版参数
#   JAVA_OPTS=-Xmx64m -Xss512k -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:ReservedCodeCacheSize=16m -XX:MaxDirectMemorySize=12m
# 注意：不要设置 -XX:MaxMetaspaceSize。Spring Boot 4 + Hibernate + AWS SDK 需要的
# 类元数据超过 96 MB，卡死 Metaspace 会让每个请求抛 OutOfMemoryError（表现为网关 502）。
# 不设置时按容器可用内存的 75% 取堆上限（512 MB 实例用这一档）。
ENTRYPOINT ["sh", "-c", "exec java ${JAVA_OPTS:--XX:MaxRAMPercentage=75} -jar /app/app.jar"]
