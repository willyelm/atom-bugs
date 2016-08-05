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
const BugsSchemeEditor = require('./bugs-scheme-editor')

class BugsSchemeView extends EventEmitter {

  constructor () {
    super()
    this.editor = new BugsSchemeEditor()
    this.editor.on('save', this.save.bind(this))
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
        this.editFromIndex(index)
      })
    })
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
    if (this.schemes) {
      this.editFromIndex(this.schemes.use)
      let button = this.buttonsView.querySelector(`button[target="${this.schemes.use}"]`)
      this.activateSchemeButton(button)
    }
    this.panelView.show()
  }

  hide () {
    this.panelView.hide()
  }

  destroy () {
    // destroy
  }

  setScheme (data) {
    this.schemes = JSON.parse(data)
    this.emit('didSelectScheme', this.getSelectedScheme())
  }

  useSettingFromProject (projectPath) {
    let schemeFile = btoa(projectPath)
    this.filePath = path.join(__dirname, `../resources/data/${schemeFile}.json`)
    fs.readFile(this.filePath, (err, data) => {
      if (err) {
        let template = path.join(__dirname, '../resources/data/schemes.json')
        fs.readFile(template, (e, templateData) => {
          this.setScheme(templateData)
        })
      } else {
        this.setScheme(data)
      }
    })
  }

  save () {
    if (this.filePath) {
      // let absolutePath = path.join(__dirname, this.filePath)
      fs.writeFile(this.filePath, JSON.stringify(this.schemes), (err) => {
        if (err) {
          return console.log(err)
        }
      })
    }
  }

  getSelectedScheme () {
    let selected = this.schemes.use
    return this.schemes[selected]
  }

  editFromIndex (index) {
    // clear previous elements
    while (this.formView.hasChildNodes()) {
      this.formView.removeChild(this.formView.lastChild)
    }
    // build form from scheme
    let scheme = this.schemes[index]
    this.emit('didSelectScheme', scheme)

    Object.keys(scheme.fields).forEach((key, index) => {
      let field = scheme.fields[key]
      let group
      switch (field.type) {
        case 'list':
          group = this.editor.createList(field)
          break
        case 'object':
          group = this.editor.createObject(field)
          break
        case 'text':
        // default:
          group = this.editor.createText(field)
          break
      }
      if (group) {
        this.formView.appendChild(group)
      }
    })
  }
}

module.exports = BugsSchemeView
