#!/usr/bin/env node
/**
 * Print the exact input the joy function sends to the model, byte for byte.
 *
 *   npm run knowledge                                      # compile /knowledge first
 *   node scripts/print-model-input.mjs "i want to ask ethan a question"
 *   node scripts/print-model-input.mjs --fingerprint       # just the knowledge id
 *
 * To see what a DEPLOYED build sends: take the published deploy's commit SHA
 * from the Netlify deploys page, borrow that commit's knowledge, and run this
 * script against it —
 *
 *   git checkout <deploy-sha> -- knowledge
 *   npm run knowledge
 *   node scripts/print-model-input.mjs "the question"
 *   git checkout HEAD -- knowledge && npm run knowledge    # put it back
 *
 * Every production request also logs `knowledge=<fingerprint>`; if it matches
 * --fingerprint here, the context is identical and no checkout is needed.
 */
import { buildModelInput, KNOWLEDGE_FINGERPRINT } from '../netlify/functions/joy.mjs'

const arg = process.argv[2]

if (!arg || arg === '--fingerprint') {
  console.log(`knowledge fingerprint: ${KNOWLEDGE_FINGERPRINT}`)
  if (!arg) console.error('\n  usage: node scripts/print-model-input.mjs "question" | --fingerprint\n')
  process.exit(0)
}

const input = buildModelInput({ mode: 'answer', question: arg.trim().slice(0, 500) })
console.log(`# knowledge fingerprint: ${KNOWLEDGE_FINGERPRINT}\n`)
for (const message of input) {
  console.log(`━━━ ${message.role} ${'━'.repeat(Math.max(0, 68 - message.role.length))}`)
  console.log(message.content)
  console.log()
}
