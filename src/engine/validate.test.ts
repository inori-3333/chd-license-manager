import { describe, expect, it } from 'vitest'
import { hardValidate } from './validate'

describe('导入硬校验', () => {
  it('阻断缺失工号', () => {
    const err = hardValidate({
      sheet: '人员',
      row: 2,
      kind: 'person',
      values: { 姓名: '测试', 岗位名称: '电气检修技术员' },
    })
    expect(err.some((e) => e.field === '工号')).toBe(true)
  })
  it('阻断纯数字岗位名', () => {
    const err = hardValidate({
      sheet: '人员',
      row: 3,
      kind: 'person',
      values: { 工号: 'X1', 姓名: '甲', 岗位名称: '12345' },
    })
    expect(err.some((e) => e.message.includes('纯数字'))).toBe(true)
  })
  it('允许含数字的业务名称', () => {
    const err = hardValidate({
      sheet: '人员',
      row: 4,
      kind: 'person',
      values: { 工号: 'X2', 姓名: '乙', 岗位名称: '1号机组值班员', 任职开始: '2024-01-01' },
    })
    expect(err).toHaveLength(0)
  })
  it('阻断结束早于开始', () => {
    const err = hardValidate({
      sheet: '证书',
      row: 5,
      kind: 'certificate',
      values: { 工号: 'X1', 证书名称: '高压电工作业证', 有效开始: '2026-01-01', 有效截止: '2025-01-01' },
    })
    expect(err.some((e) => e.message.includes('早于'))).toBe(true)
  })
  it('阻断无法解析的日期', () => {
    const err = hardValidate({
      sheet: '人员',
      row: 6,
      kind: 'person',
      values: { 工号: 'X3', 姓名: '丙', 岗位名称: '技术员', 任职开始: '昨天' },
    })
    expect(err.some((e) => e.message.includes('无法解析'))).toBe(true)
  })
})
