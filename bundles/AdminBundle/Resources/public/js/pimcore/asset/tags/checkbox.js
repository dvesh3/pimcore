/**
 * Pimcore
 *
 * This source file is available under two different licenses:
 * - GNU General Public License version 3 (GPLv3)
 * - Pimcore Enterprise License (PEL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 * @copyright  Copyright (c) Pimcore GmbH (http://www.pimcore.org)
 * @license    http://www.pimcore.org/license     GPLv3 and PEL
 */

pimcore.registerNS("pimcore.asset.tags.checkbox");
pimcore.asset.tags.checkbox = Class.create(pimcore.asset.tags.abstract, {

    type:"checkbox",

    initialize:function (data, fieldConfig) {

        this.data = "";

        if (data) {
            this.data = data;
        }
        this.fieldConfig = fieldConfig;
    },

    getGridColumnConfig:function (field) {
        var columnConfig = {
            text:ts(field.label),
            dataIndex:field.key,
            renderer:function (key, value, metaData, record, rowIndex, colIndex, store) {
                metaData.tdCls += ' x-grid-check-col-td';
                return Ext.String.format('<div style="text-align: center"><div role="button" class="x-grid-checkcolumn{0}" style=""></div></div>', value ? '-checked' : '');
            }.bind(this, field)
        };

        return columnConfig;
    },

    getGridColumnFilter:function (field) {
        return {type:'boolean', dataIndex:field.key};
    },

    getLayoutEdit:function () {

        var checkbox = {
            name:this.fieldConfig.name,
            value: this.data,
            width: 25,
            handler: function (checkbox, checked) {
                this.dataChanged = true;
                this.data = this.checkbox.getValue();
            }.bind(this),
        };

        if (this.fieldConfig.labelWidth) {
            checkbox.labelWidth = this.fieldConfig.labelWidth;
        }

        this.checkbox = new Ext.form.Checkbox(checkbox);

        var componentCfg = {
            fieldLabel:this.fieldConfig.title,
            layout: 'fit',
            items: this.checkbox,
            componentCls: "object_field",
            border: false,
            style: {
                padding: 0
            }
        };

        this.component = Ext.create('Ext.form.FieldContainer', componentCfg);

        return this.component;
    },

    getLayoutShow:function () {

        this.component = this.getLayoutEdit();
        this.component.disable();

        return this.component;
    },

    getValue:function () {
        return this.data;
    },

    getName:function () {
        return this.fieldConfig.name;
    },

    isInvalidMandatory:function () {
        return false;
    },

    isDirty:function () {
        return this.dataChanged;
    }
});