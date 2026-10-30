// Plugin PostCSS: depois do Tailwind, duplica cada regra que tem cor sob html[data-qt="tema.ud"]
// com as cores mapeadas (src/lib/theme.mjs). O tema padrão (amber.std) não gera nada: o visual atual não muda.
const path = require('path')
const { pathToFileURL } = require('url')

module.exports = () => ({
  postcssPlugin: 'qt-themes',
  async OnceExit(root) {
    const T = await import(pathToFileURL(path.join(__dirname, '../src/lib/theme.mjs')).href)
    const keys = []
    for (const th of T.THEMES) for (const ud of T.UPDOWN) if (`${th}.${ud}` !== T.DEFAULT_KEY) keys.push(`${th}.${ud}`)
    const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|oklch\(|\b(black|white)\b/
    const rules = []
    root.walkRules(rule => {
      if (rule.parent && rule.parent.type === 'atrule' && /keyframes/.test(rule.parent.name)) return
      if (rule.selector.includes('data-qt=')) return
      const decls = rule.nodes.filter(n => n.type === 'decl' && (n.prop.startsWith('--') ? COLOR.test(n.value) : T.isColorProp(n.prop) && COLOR.test(n.value)))
      if (decls.length) rules.push([rule, decls])
    })
    for (const [rule, decls] of rules) {
      let after = rule
      for (const key of keys) {
        const nr = rule.clone({ selector: T.scopeSelector(rule.selector, key), nodes: [] })
        for (const d of decls) nr.append(d.clone({ value: T.mapCssValue(d.value, key) }))
        after.after(nr); after = nr
      }
    }
  },
})
module.exports.postcss = true
