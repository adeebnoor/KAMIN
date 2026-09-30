import {defineConfig} from '@playwright/test'
import base from './playwright.config.js'

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: '**/visual.spec.js',
  retries: 0,
  updateSnapshots: 'none',
  snapshotPathTemplate: '{testDir}/visual-baselines/{projectName}/{arg}{ext}',
  expect: {toHaveScreenshot: {animations:'disabled',caret:'hide',maxDiffPixelRatio:0.002}},
  use: {...base.use,locale:'en-US',timezoneId:'UTC',colorScheme:'light',reducedMotion:'reduce'},
})
