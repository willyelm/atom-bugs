/**
 * Bugs Scheme View
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
'use strict'

const EventEmitter = require('events')

function textTemplate (field) {
  let name = `${field.title}:`
  let optionalCheck = ''
  if (field.optional) {
    let token = new Date().getTime()
    optionalCheck = `<div class="checkbox">
      <label for="${token}">
        <input id="${token}" type="checkbox">
        <div class="setting-title">${field.title}</div>
      </label>
    </div>`
    name = ''
  }
  return `<div class="bugs-config-group">
    <label class="bugs-config-name">${name}</label>
    <div class="bugs-config-value">\
      ${optionalCheck}
      <input class="form-control"
        type="text"
        placeholder="${field.placeholder || ''}"
        value="${field.value || ''}">
    </div>
  </div>`
}

function propertyTemplate (field) {
  let readonly = field.readonly ? 'readonly' : ''
  let button
  let inputs
  if (field.new) {
    button = `<button class="btn" type="button">
        <i class="icon-plus"></i>
      </button>`
  } else {
    button = `<button class="btn" type="button">
        <i class="bugs-icon-trash-o"></i>
      </button>`
  }
  if (field.type === 'item') {
    inputs = `<input type="text"
      name="value"
      value="${field.value || ''}"
      class="form-control"
      style="width:100%;"
      placeholder="Value"
      ${readonly}>`
  } else {
    inputs = `
      <input type="text"
        name="name" value="${field.name || ''}"
        class="form-control" placeholder="Name"
        ${readonly}>
      <input type="text"
        name="value" value="${field.value || ''}"
        class="form-control" placeholder="Value"
        ${readonly}>`
  }
  return `<div class="bugs-config-group">
    <label class="bugs-config-name">${field.label || ''}</label>
    <div class="bugs-config-value bugs-config-object">
      <div class="input-group">
        ${inputs}
      </div>
      <span class="input-group-btn">
        ${button}
      </span>
    </div>
  </div>`
}

class BugsSchemeEditor extends EventEmitter {
  createText (field) {
    return new Promise((resolve, reject) => {
      let element = document.createElement('div')
      element.className = 'form-group'
      element.innerHTML = textTemplate(field)
      let handler = false
      let input = element.querySelector('input[type=text]')
      let toggle = element.querySelector('input[type=checkbox]')
      input.addEventListener('keydown', (e) => {
        if (e.keyCode === 13) {
          this.emit('didHitEnter')
        }
        clearTimeout(handler)
        handler = setTimeout(() => {
          field.value = input.value
          this.emit('save')
        }, 500)
      })
      if (toggle) {
        input.disabled = !field.active
        toggle.checked = field.active
        toggle.addEventListener('change', () => {
          field.active = toggle.checked
          input.disabled = !toggle.checked
          this.emit('save')
        })
      }
      resolve(element)
    })
  }
  createObjectItem (name, value, values, group, isArray) {
    return new Promise((resolve, reject) => {
      let item = document.createElement('div')
      item.innerHTML = propertyTemplate({
        type: isArray ? 'item' : 'property',
        name: name,
        value: value,
        readonly: true
      })
      item.querySelector('button').addEventListener('click', () => {
        if (isArray) {
          let index = values.indexOf(value)
          values.splice(index, 1)
        } else {
          delete values[name]
        }
        this.emit('save')
        group.removeChild(item)
      })
      group.appendChild(item)
      resolve(item)
    })
  }

  createList (field) {
    return this.createObject(field, true)
  }

  createObject (field, isArray) {
    return new Promise((resolve, reject) => {
      let group = document.createElement('div')
      let empty = isArray ? [] : {}
      group.className = 'form-group'
      group.innerHTML = propertyTemplate({
        type: isArray ? 'item' : 'property',
        label: field.title,
        new: true
      })
      let inputName = group.querySelector('input[name="name"]')
      let inputValue = group.querySelector('input[name="value"]')
      let values = field.value || empty
      let items = []
      // add item
      Object.keys(values).forEach((name) => {
        let value = values[name]
        items[name] = this.createObjectItem(name, value, values, group, isArray)
      })
      group.querySelector('button').addEventListener('click', () => {
        let value = inputValue.value
        let name = isArray ? false : inputName.value
        if (value !== '' && name !== '') {
          if (isArray) {
            values.push(inputValue.value)
          } else {
            values[name] = value
            let duplicate = items[value]
            if (duplicate && duplicate.parentNode) {
              group.removeChild(duplicate)
            }
            inputName.value = ''
          }
          inputValue.value = ''
          this.createObjectItem(name, value, values, group, isArray)
          field.value = values
          this.emit('save')
        }
      })
      resolve(group)
    })
  }
}

module.exports = BugsSchemeEditor
