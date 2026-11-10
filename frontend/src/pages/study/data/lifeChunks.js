// 「高性价比人生指南」34 章全文的懒加载表。
//
// 每章一份 ./life/chNN.js（约 70 KB），点开哪一章才取哪一章——34 章合计 2.3 MB，
// 一次性进主包会把学习页拖死。写成「显式列出来的动态 import」而不是
// import.meta.glob：Vite 一样会把每章切成独立 chunk，但每个文件都被**字面引用**到，
// 静态检查的孤儿文件项认得出它们（glob 模式它不认，会全报成没人用）。
export const lifeChapterLoaders = {
  ch01: () => import('./life/ch01.js'),
  ch02: () => import('./life/ch02.js'),
  ch03: () => import('./life/ch03.js'),
  ch04: () => import('./life/ch04.js'),
  ch05: () => import('./life/ch05.js'),
  ch06: () => import('./life/ch06.js'),
  ch07: () => import('./life/ch07.js'),
  ch08: () => import('./life/ch08.js'),
  ch09: () => import('./life/ch09.js'),
  ch10: () => import('./life/ch10.js'),
  ch11: () => import('./life/ch11.js'),
  ch12: () => import('./life/ch12.js'),
  ch13: () => import('./life/ch13.js'),
  ch14: () => import('./life/ch14.js'),
  ch15: () => import('./life/ch15.js'),
  ch16: () => import('./life/ch16.js'),
  ch17: () => import('./life/ch17.js'),
  ch18: () => import('./life/ch18.js'),
  ch19: () => import('./life/ch19.js'),
  ch20: () => import('./life/ch20.js'),
  ch21: () => import('./life/ch21.js'),
  ch22: () => import('./life/ch22.js'),
  ch23: () => import('./life/ch23.js'),
  ch24: () => import('./life/ch24.js'),
  ch25: () => import('./life/ch25.js'),
  ch26: () => import('./life/ch26.js'),
  ch27: () => import('./life/ch27.js'),
  ch28: () => import('./life/ch28.js'),
  ch29: () => import('./life/ch29.js'),
  ch30: () => import('./life/ch30.js'),
  ch31: () => import('./life/ch31.js'),
  ch32: () => import('./life/ch32.js'),
  ch33: () => import('./life/ch33.js'),
  ch34: () => import('./life/ch34.js'),
}
