// AI "first attempt" — Artwork Analyzer agent.
// Analyzes an image ATTACHED to the task (uploaded via the Files tab) using the host's Python +
// Pillow: dimensions, transparency, DPI, low-resolution — produces measurable findings + a
// quality score, recorded as an AiRun (never touches the source; read-only analysis). This is
// the hybrid model's first step: a human then reviews the AI's findings and approves or fixes.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, unlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { db } from './db.js'

const pexec = promisify(execFile)
const PY = `
import sys, json
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
try:
    im=Image.open(sys.argv[1])
    w,h=im.size
    d=im.info.get('dpi',(0,0)); dpi=int(round(d[0])) if d and d[0] else 0
    ha = im.mode in ('RGBA','LA') or (im.mode=='P' and 'transparency' in im.info)
    print(json.dumps({'ok':True,'width':w,'height':h,'mode':im.mode,'format':im.format,'dpi':dpi,'hasAlpha':bool(ha)}))
except Exception as e:
    print(json.dumps({'ok':False,'error':str(e)[:200]}))
`

export async function runArtworkAnalysis(taskId, actorId) {
  const img = await db.taskFile.findFirst({
    where: { taskId, OR: [{ fileType: { startsWith: 'image/' } }, { fileName: { endsWith: '.png' } }, { fileName: { endsWith: '.jpg' } }, { fileName: { endsWith: '.jpeg' } }, { fileName: { endsWith: '.webp' } }] },
    orderBy: { createdAt: 'desc' },
  })
  const run = await db.aiRun.create({ data: { taskId, agentType: 'Artwork Analyzer', modelName: 'pillow-analysis', runStatus: 'Running', startedAt: new Date() } })
  if (!img) {
    await db.aiRun.update({ where: { id: run.id }, data: { runStatus: 'Failed', errorMessage: 'No image attached — add an image in the Files tab first.', completedAt: new Date() } })
    return db.aiRun.findUnique({ where: { id: run.id } })
  }
  const b64 = String(img.dataUrl).replace(/^data:[^;]+;base64,/, '')
  const tmp = path.join(os.tmpdir(), 'ai-' + run.id + '.img')
  try {
    await writeFile(tmp, Buffer.from(b64, 'base64'))
    const { stdout } = await pexec('/usr/bin/python3', ['-c', PY, tmp], { timeout: 60000 })
    const a = JSON.parse(stdout.trim())
    if (!a.ok) throw new Error(a.error || 'analysis failed')

    const issues = []
    if (!a.hasAlpha) issues.push('No transparent background — likely needs background removal')
    const minSide = Math.min(a.width, a.height)
    if (minSide < 1000) issues.push(`Low resolution (${a.width}×${a.height}px)`)
    if (a.dpi && a.dpi < 150) issues.push(`Low DPI (${a.dpi})`)
    if (!a.dpi) issues.push('DPI not embedded in file')

    let quality = 100
    if (!a.hasAlpha) quality -= 25
    if (minSide < 1000) quality -= 30
    else if (minSide < 1500) quality -= 10
    if (a.dpi && a.dpi < 150) quality -= 15
    quality = Math.max(0, quality)

    const findings = { ...a, printSizeAt300dpi: { w_in: +(a.width / 300).toFixed(1), h_in: +(a.height / 300).toFixed(1) }, issues }
    const summary = issues.length
      ? `${issues.length} issue(s) found: ${issues.join('; ')}`
      : 'Looks production-ready — transparent background, good resolution.'
    await db.aiRun.update({
      where: { id: run.id },
      data: { runStatus: 'Completed', confidenceScore: 0.92, qualityScore: quality / 100, inputImageUrl: img.fileName, metadata: JSON.stringify(findings), resultSummary: summary, completedAt: new Date() },
    })
    if (actorId) {
      await db.comment.create({ data: { taskId, commentType: 'Feedback', commentText: `🤖 AI Artwork Analysis — quality ${quality}%. ${summary}`, commentedById: actorId } }).catch(() => {})
      await db.activity.create({ data: { taskId, activityType: 'AiRun', performedById: actorId, notes: `AI analysis: quality ${quality}%` } }).catch(() => {})
    }
  } catch (e) {
    await db.aiRun.update({ where: { id: run.id }, data: { runStatus: 'Failed', errorMessage: String(e.message).slice(0, 300), completedAt: new Date() } })
  } finally {
    unlink(tmp).catch(() => {})
  }
  return db.aiRun.findUnique({ where: { id: run.id } })
}
