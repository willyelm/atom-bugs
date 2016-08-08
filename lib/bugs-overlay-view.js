/**
 * Bugs Overlay View
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
'use strict'

const _ = require('lodash')

class BugsOverlayView {

  constructor (editor, range) {
    let marker = editor.markBufferRange(range)
    this.panelView = document.createElement('atom-bugs-overlay')
    this.panelView.className = 'native-key-bindings'
    this.panelView.setAttribute('tabindex', -1)
    this.decorator = editor.decorateMarker(marker, {
      type: 'overlay',
      class: 'bugs-evaluate-expression',
      item: this.panelView
    })
  }

  static header (label, title) {
    let type = String(label).toLowerCase()
    return `<span class="bugs-label-${type} bugs-label">${label}</span><strong>${title || ''}</strong>`
  }

  static inspect (value, {fromSource} = {}) {
    let inspector = document.createElement('atom-bugs-inspector')
    let header = document.createElement('atom-bugs-inspector-header')
    let content = document.createElement('atom-bugs-inspector-body')
    inspector.appendChild(header)
    inspector.appendChild(content)
    if (_.isArray(value)) {
      header.innerHTML = BugsOverlayView.header('Array', fromSource)
      content.innerHTML = String(value) || '[]'
    } else if (_.isDate(value)) {
      header.innerHTML = BugsOverlayView.header('Date', fromSource)
      content.innerHTML = String(value)
    } else if (_.isFunction(value)) {
      header.innerHTML = BugsOverlayView.header('Function', fromSource)
      content.innerHTML = String(value)
    } else if (_.isObject(value)) {
      header.innerHTML = BugsOverlayView.header('Object', fromSource)
      content.innerHTML = JSON.stringify(value, null, 2)
    } else if (_.isString(value)) {
      header.innerHTML = BugsOverlayView.header('String', fromSource)
      content.innerHTML = `'${value}'`
    } else if (_.isNumber(value)) {
      header.innerHTML = BugsOverlayView.header('Number', fromSource)
      content.innerHTML = String(value)
    } else if (_.isBoolean(value)) {
      header.innerHTML = BugsOverlayView.header('Boolean', fromSource)
      content.innerHTML = String(value)
    } else {
      header.innerHTML = BugsOverlayView.header('Undefined', fromSource)
      inspector.removeChild(content)
    }
    return inspector
  }

  show (value, options) {
    let visor = BugsOverlayView.inspect(value, options)
    this.panelView.innerHTML = ''
    this.panelView.appendChild(visor)
  }

  destroy () {
    // destroy
    this.panelView = null
    this.decorator.destroy()
  }
}

module.exports = BugsOverlayView
