import { readFileSync } from 'node:fs'
import { buildOrgTree, flattenNodes } from '../src/lib/formasi.ts'
import type { FormasiData } from '../src/lib/types.ts'

const data = JSON.parse(readFileSync('public/data/formasi.json', 'utf8')) as FormasiData
const tree = buildOrgTree(data.rows)
const flat = flattenNodes(tree)

console.log('root kebutuhan:', tree.kebutuhan, '(expected', data.summary.kebutuhan + ')')
console.log('level-2 order :', tree.children.map((c) => c.label).join(' | '))
console.log('last level-2  :', tree.children[tree.children.length - 1].label)

const cm = flat.filter(({ node }) => node.coManaging)
console.log('co-managing nodes:', cm.length)
cm.slice(0, 6).forEach(({ node }) => console.log('  -', node.label, '| parent kind:', node.kind))
const balai = tree.children.find((c) => c.kind === 'group')?.children[0]
console.log('sample balai  :', balai?.label)
console.log('  first child :', balai?.children[0]?.label, '| coManaging:', balai?.children[0]?.coManaging)
const direktorat = tree.children.find((c) => c.label.startsWith('DIREKTORAT SISTEM'))
console.log('sample dir    :', direktorat?.label)
console.log('  first child :', direktorat?.children[0]?.label, '| coManaging:', direktorat?.children[0]?.coManaging)
