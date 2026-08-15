import { expect, test } from '@playwright/test'
import path from 'node:path'

test.beforeEach(async ({ page }) => {
  await page.goto('/#/today')
})

test('adds and reviews a recitation item', async ({ page }) => {
  await page.getByRole('link', { name: '资料库' }).click()
  await page.getByRole('button', { name: '添加背诵' }).click()
  await page.getByLabel('标题').fill('劝学节选')
  await page.getByLabel('分类').fill('文章')
  await page.getByLabel('学科').fill('语文')
  await page.getByLabel('正文').fill('故木受绳则直，金就砺则利。\n君子博学而日参省乎己，则知明而行无过矣。')
  await page.getByRole('button', { name: '保存并加入复习' }).click()
  await expect(page.getByText('劝学节选')).toBeVisible()
  await page.getByRole('link', { name: '今日' }).click()
  await page.getByRole('link', { name: '复习劝学节选' }).click()
  await page.getByRole('button', { name: '查看原文' }).click()
  await page.getByRole('button', { name: '这段完成，继续' }).click()
  await page.getByRole('button', { name: '查看原文' }).click()
  await page.getByRole('button', { name: '这段完成，继续' }).click()
  await page.getByRole('button', { name: '记住 进入下一阶' }).click()
  await expect(page.getByText('今天的到期任务完成了')).toBeVisible()
})

test('sets a parent pin and reaches reward management', async ({ page }) => {
  await page.getByRole('link', { name: '我的' }).click()
  await page.getByRole('button', { name: /家长入口/ }).click()
  await page.locator('input[name="pin"]').fill('2580')
  await page.getByRole('button', { name: '保存并进入' }).click()
  await expect(page.getByRole('heading', { name: '奖励管理' })).toBeVisible()
  await expect(page.getByText('7 天完成率')).toBeVisible()
})

test('has no horizontal overflow at the target viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/#/growth')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBe(0)
  await expect(page.getByRole('navigation', { name: '主要导航' })).toBeVisible()
})

test('stores a mistake photo and reveals the answer', async ({ page }) => {
  await page.getByRole('link', { name: '资料库' }).click()
  await page.getByRole('tab', { name: /错题本/ }).click()
  await page.getByRole('button', { name: '添加错题' }).click()
  await page.locator('input[type="file"]').setInputFiles(path.resolve('public/icon-512.png'))
  await page.locator('input[name="title"]').fill('函数单调性错题')
  await page.locator('input[name="subject"]').fill('数学')
  await page.locator('textarea[name="answer"]').fill('先判断定义域。')
  await page.locator('textarea[name="analysis"]').fill('使用定义法比较函数值。')
  await page.locator('textarea[name="errorReason"]').fill('忽略定义域。')
  await page.getByRole('button', { name: '保存并加入复习' }).click()
  await page.getByRole('link', { name: /函数单调性错题/ }).click()
  await expect(page.getByRole('img', { name: '函数单调性错题原题' })).toBeVisible()
  await page.getByRole('button', { name: '查看答案与解析' }).click()
  await expect(page.getByText('使用定义法比较函数值。')).toBeVisible()
})

test('reloads from the service worker while offline', async ({ page, context }) => {
  await page.goto('/#/today')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker?.controller)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: '今天，稳稳推进' })).toBeVisible()
  await context.setOffline(false)
})

test('keeps dark mode, reduced motion and touch targets usable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('/#/today')
  const result = await page.evaluate(() => {
    const controls = [...document.querySelectorAll<HTMLElement>('button, a, input, textarea')]
      .filter((element) => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0' && rect.width > 1 && rect.height > 1 && rect.bottom > 0 && rect.top < innerHeight
      })
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      background: getComputedStyle(document.querySelector('.app-frame')!).backgroundColor,
      reducedDuration: getComputedStyle(document.querySelector('.nav-item')!).transitionDuration,
      undersized: controls.filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width < 44 || rect.height < 44
      }).map((element) => element.getAttribute('aria-label') || element.textContent?.trim()).filter(Boolean),
    }
  })
  expect(result.overflow).toBe(0)
  expect(result.background).toBe('rgb(18, 24, 21)')
  expect(Number.parseFloat(result.reducedDuration)).toBeLessThanOrEqual(0.001)
  expect(result.undersized).toEqual([])
})
