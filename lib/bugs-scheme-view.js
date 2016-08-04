/* global atom */
'use strict'

function BugsSchemeView () {
  let panel = document.createElement('atom-bugs-schemes')
  panel.className = 'native-key-bindings'
  panel.innerHTML = `<div class="atom-bugs-scheme-selector">
    <div class="btn-group">
      <button type="button" class="btn btn-default active">
        <i class="bugs-icon-file-code-o"></i> Current File
      </button>
      <button type="button" class="btn btn-default">
        <i class="bugs-icon-desktop"></i>  Workspace
      </button>
      <button type="button" class="btn btn-default">
        <i class="bugs-icon-chrome"></i> Chrome
      </button>
    </div>
  </div>
  <div class="atom-bugs-scheme-configurator">
    <form>
      <div class="form-group">
        <label class="control-label">Command</label>
        <textarea class="form-control"></textarea>
      </div>
      <div class="text-center">
        <button type="button" id="closeButton" class="btn btn-default">
          <span class="icon-check"></span>
          Use Settings
        </button>
      </div>
    </form>
  </div>`
  panel
    .querySelector('#closeButton')
    .addEventListener('click', this.hide.bind(this))
  this.panelView = atom.workspace.addModalPanel({
    item: panel,
    visible: false
  })
}

BugsSchemeView.prototype = Object.create({}, {
  show: {
    value () {
      this.panelView.show()
    }
  },
  hide: {
    value () {
      this.panelView.hide()
    }
  },
  destroy: {
    value () {
      // destroy
    }
  }
})

module.exports = BugsSchemeView
