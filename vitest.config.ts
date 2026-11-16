import { defineConfig } from 'vitest/config'

/**
 * 单测只覆盖纯函数（路径计算、格式化），不跑 DOM。
 * 组件测试需要 happy-dom / jsdom，暂时不引入。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
