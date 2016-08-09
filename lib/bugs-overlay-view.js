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
    this.panelView.innerHTML = 'loading...'
    this.decorator = editor.decorateMarker(marker, {
      type: 'overlay',
      class: 'bugs-evaluate-expression',
      item: this.panelView,
      position: 'tail'
    })
  }

  static label (type, label) {
    return `<span class="bugs-label-${type} bugs-label">${label}</span>`
  }

  static header (type, label, title) {
    let lbl = BugsOverlayView.label(type, label)
    return `<strong class="pull-right">${title || ''}</strong> ${lbl}`
  }

  static inspect (data, {fromSource} = {}) {
    let inspector = document.createElement('atom-bugs-inspector')
    let header = document.createElement('atom-bugs-inspector-header')
    let content = document.createElement('atom-bugs-inspector-body')
    inspector.appendChild(header)
    inspector.appendChild(content)
    content.setAttribute('tabindex', -1)
    if (data.get) {
      data.get().then((res) => {
        header.innerHTML = BugsOverlayView.header(res.type, res.className, fromSource)
        BugsOverlayView.setProperties(content, { withData: res })
      })
    } else {
      header.innerHTML = BugsOverlayView.header(data.type, data.className, fromSource)
      content.innerHTML = data.value
    }
    return inspector
  }

  static setProperties (content, {withData} = {}) {
    _.forEach(withData.value, (prop, name) => {
      let property = document.createElement('atom-bugs-inspector-property')
      let label = BugsOverlayView.label(prop.type, prop.className ? prop.className[0] : '-')
      let inspectable = prop.get
      property.innerHTML = `${label}<strong>${name}</strong>: ${inspectable ? prop.className : prop.value}`
      content.appendChild(property)
      if (inspectable) {
        let properties = document.createElement('atom-bugs-inspector-property')
        let render = false
        let icon = document.createElement('i')
        icon.className = 'bugs-icon-plus-square-o'
        property.appendChild(icon)
        property.style.cursor = 'pointer'
        properties.classList.add('hide')
        content.appendChild(properties)
        property.addEventListener('click', (e) => {
          e.stopPropagation()
          if (!render) {
            render = true
            prop.get().then((res) => {
              BugsOverlayView.setProperties(properties, { withData: res })
            })
          }
          if (properties.classList.contains('hide')) {
            properties.classList.remove('hide')
            icon.className = 'bugs-icon-minus-square-o'
          } else {
            properties.classList.add('hide')
            icon.className = 'bugs-icon-plus-square-o'
          }
        })
      }
    })
  }

  show (value, options) {
    setTimeout(() => {
      this.panelView.innerHTML = ''
      let visor = BugsOverlayView.inspect(value, options)
      this.panelView.appendChild(visor)
    }, 0)
  }

  destroy () {
    // destroy
    this.panelView = null
    this.decorator.destroy()
  }
}

module.exports = BugsOverlayView
