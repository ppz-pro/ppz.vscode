import $ from '../../script/ppz-query.js'
import Page from '../../script/page.js'
import Pagination, { config } from '../../cmps/pagination.js'
import TDHelperClosure from './td-helper-closure.js'

// 有些表，没主键，即使理论上可以精准删除、编辑，但复杂度攀升，不做考虑
new Page({
  async init() {
    const page = this
    if(!this.state) {
      // 恢复 state 仅考虑恢复原来的页面，如果页面上的真实数据变了，不应在恢复 state 时处理
      // 因为页面在一直运行的过程中，真实数据也在变化
      const selectParams = {
        pagination: {
          index: 1,
          size: config.size,
          count: 0
        }
      }
      const { fields, records, count } = await $.api.getData(selectParams)
      selectParams.fields = fields.map(f => f.name)
      selectParams.pagination.count = count
      
      this.state = {
        fields,
        records,
        selectParams,
        focusedCoordinate: {},
        table: initTableState(fields, records)
      }
      this.saveState()
    } else
      console.debug('initial state', page.state)
    const state = page.state
    const isEditing = () => state.table.editing.some(
      item => Object.entries(item.changed).length
    )

    const header = new function() {
      const pagination = new function() {
        const { count, index, size } = page.state.selectParams.pagination
        return Pagination({
          count, index, size,
          onChange({ index, size }) {
            page.state.selectParams.pagination = { index, size }
            // count 在返回后设置，state 在返回后保存
            refreshData()
          }
        })
      }

      this.$el = $.El('header', '', [
        $.El('nav', '', [
          $.Span(PPZ.initData.connection),
          $.Icon('arrow-right'),
          $.Span(PPZ.initData.database),
          $.Icon('arrow-right'),
          $.Span(PPZ.initData.table)
        ]),
        $.Div('operations', [
          $.Div('btns', [
            Button('刷新', 'light', function() {
              if(isEditing())
                $.noty.warn('请先保存或撤销全部修改')
              else
                refreshData()
            }),
            Button('字段选择', 'filter', function() {
            }),
            Button('新增', 'add', function() {
            }),
            Button('拷贝当前记录', 'copy', function() {
            }),
            Button('保存', 'save', function() {
              console.log(state.table)
            }),
            Button('撤销全部', 'undo', function() {
            }),
            Button('删除当前记录', 'delete', function() {
            }),
            Button('打开 sql 文件', 'sql', function() {
            })
          ]),
          pagination.$el
        ])
      ])
      
      function Button(title, icon, handler) {
        const el = $.Button('', [$.Icon(icon)], handler)
        el.title = title
        return el
      }
      
      async function refreshData() {
        const { fields, records } = await $.api.getData(page.state.selectParams)
        state.fields = fields
        state.records = records
        state.table = initTableState(fields, records)
        if(state.focusedCoordinate.x != undefined) {
          delete state.focusedCoordinate.x
          delete state.focusedCoordinate.y
          table.$style.innerHTML = ''
        }
        page.saveState()
        table.updateData()
      }
    }

    const table = new function() {
      const $style = this.$style = $.El('style')
      const TDHelper = TDHelperClosure(
        $, $style,
        state.focusedCoordinate,
        state.table && state.table.editing, // 表示只有此组件可以改变它
        () => page.saveState()
      )
      const table = new $.Table(
        getTHead(),
        getTBody()
      )
      this.updateData = function() {
        table.thead(getTHead())
        table.tbody(getTBody())
      }

      function getTHead() {
        return [$.El('th', 'pre-unit'), ...state.fields.map(f => f.name)]
      }
      function getTBody() {
        return state.records.map(
          (record, rowIndex) => ([
            $.El('td', 'pre-unit'),
            ...state.fields.map(
              (field, columnIndex) =>
                new TDHelper(record, rowIndex, field, columnIndex).$el
            )
          ])
        )
      }

      this.$el = $.Div('table-wrapper', [table.$el, $style])
    }

    $('body').append(
      header.$el,
      table.$el
    )
  }
})

function initTableState(fields, records) {
  // 应在 save 或 cancel 时清空，否则至少应该找一个“点”清空
  const pks = fields.filter(f => f.pk).map(f => f.name)
  if(pks.length == 0)
    return null
  return {
    editing: records.map(record => ({
      pk: Object.fromEntries(pks.map(pk => [pk, record[pk]])),
      changed: {}
    })),
    deleting: []
  }
}