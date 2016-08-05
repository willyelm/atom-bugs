/* global atom, btoa */
/**
 * Bugs Scheme View
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
'use strict'

const fs = require('fs')
const path = require('path')
const EventEmitter = require('events')
// Using JSON files to store the scheme project references
// TODO: Use NeDB(something like sqlite but as mongodb) to store the settings.

class BugsSchemeView extends EventEmitter {

  constructor () {
    super()
    let panel = document.createElement('atom-bugs-schemes')
    panel.className = 'native-key-bindings'
    panel.innerHTML = `
    <div class="atom-bugs-scheme-selector">
      <div class="btn-group">
        <button type="button" target="currentFile" class="atom-bugs-scheme-select btn btn-default">
          <i class="bugs-icon-file-code-o"></i> Current File
        </button>
        <button type="button" target="workspace" class="atom-bugs-scheme-select btn btn-default">
          <i class="bugs-icon-flask"></i>  Workspace
        </button>
        <button type="button" target="remote" class="atom-bugs-scheme-select btn btn-default">
          <i class="bugs-icon-wifi"></i>  Remote
        </button>
        <button type="button" target="chrome" class="atom-bugs-scheme-select btn btn-default" disabled>
          <i class="bugs-icon-chrome"></i> Chrome (WIP)
        </button>
      </div>
    </div>
    <div class="atom-bugs-scheme-configurator">
      <form></form>
      <div class="text-center">
        <button type="button" id="closeButton" class="btn btn-default">
          <span class="icon-check"></span> Close Scheme Editor
        </button>
      </div>
    </div>`
    this.formView = panel.querySelector('form')
    this.buttonsView = panel.querySelector('.atom-bugs-scheme-selector .btn-group')
    let selectors = Array.from(this.buttonsView.querySelectorAll('.atom-bugs-scheme-select'))
    let closeButton = panel.querySelector('#closeButton')
    // attach scheme open
    closeButton.addEventListener('click', this.hide.bind(this))
    selectors.forEach((b) => {
      b.addEventListener('click', () => {
        this.activateSchemeButton(b)
        let index = b.getAttribute('target')
        this.schemes.use = index
        this.save()
        this.openFromIndex(index)
      })
    })
    this.event = new EventEmitter()
    this.schemes = {}
    this.panelView = atom.workspace.addModalPanel({
      item: panel,
      visible: false
    })
  }

  activateSchemeButton (button) {
    let selectors = Array.from(this.buttonsView.querySelectorAll('.atom-bugs-scheme-select'))
    selectors.forEach((ob) => {
      ob.classList.remove('active')
    })
    button.classList.add('active')
  }

  show () {
    this.openFromIndex(this.schemes.use)
    let button = this.buttonsView.querySelector(`button[target="${this.schemes.use}"]`)
    this.activateSchemeButton(button)
    this.panelView.show()
  }

  hide () {
    this.panelView.hide()
  }

  destroy () {
    // destroy
  }

  useSettingFromProject (projectPath) {
    let schemeFile = btoa(projectPath)
    let scheme
    try {
      this.filePath = `../resources/data/${schemeFile}.json`
      scheme = require(this.filePath)
    } catch (e) {
      scheme = require('../resources/data/schemes.json')
    } finally {
      // clone scheme
      this.schemes = JSON.parse(JSON.stringify(scheme))
      this.emit('didSelectScheme', this.getSelectedScheme())
    }
  }

  save () {
    if (this.filePath) {
      let absolutePath = path.join(__dirname, this.filePath)
      fs.writeFile(absolutePath, JSON.stringify(this.schemes), (err) => {
        if (err) {
          return console.log(err)
        }
        // console.log('scheme saved.')
      })
    }
  }

  getSelectedScheme () {
    let selected = this.schemes.use
    return this.schemes[selected]
  }

  openFromIndex (index) {
    // clear previous elements
    while (this.formView.hasChildNodes()) {
      this.formView.removeChild(this.formView.lastChild)
    }
    // build form from scheme
    let scheme = this.schemes[index]
    this.emit('didSelectScheme', scheme)
    Object.keys(scheme.fields).forEach((key, index) => {
      let field = scheme.fields[key]
      let group = document.createElement('div')
      group.className = 'form-group'
      switch (field.type) {
        case 'text':
        default:
          let label = document.createElement('label')
          let input = document.createElement('input')
          let handler
          label.className = 'control-label'
          label.innerHTML = field.title
          input.className = 'form-control'
          input.placeholder = field.placeholder
          if (field.value) {
            input.value = field.value
          }
          input.addEventListener('keydown', (e) => {
            if (e.keyCode === 13) {
              this.hide()
            }
            clearTimeout(handler)
            handler = setTimeout(() => {
              field.value = input.value
              this.save()
            }, 500)
          })
          group.appendChild(label)
          group.appendChild(input)
          break
      }
      this.formView.appendChild(group)
    })
  }
}

module.exports = BugsSchemeView
