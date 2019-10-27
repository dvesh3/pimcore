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

pimcore.registerNS("pimcore.asset.helpers.gridTabAbstract");
pimcore.asset.helpers.gridTabAbstract = Class.create({

    objecttype: 'asset',
    batchPrepareUrl: "/admin/asset-helper/get-batch-jobs",
    batchProcessUrl: "/admin/asset-helper/batch",
    exportPrepareUrl: "/admin/asset-helper/get-export-jobs",
    exportProcessUrl: "/admin/asset-helper/do-export",

    createGrid: function (columnConfig) {
    },

    openColumnConfig: function (allowPreview) {
        var fields = this.getGridConfig().columns;

        var fieldKeys = Object.keys(fields);

        var visibleColumns = [];
        for (var i = 0; i < fieldKeys.length; i++) {
            var field = fields[fieldKeys[i]];
            if (!field.hidden) {
                var fc = {
                    key: fieldKeys[i],
                    label: field.fieldConfig.label,
                    dataType: field.fieldConfig.type,
                    layout: field.fieldConfig.layout,
                    language: field.fieldConfig.language,
                };
                if (field.fieldConfig.width) {
                    fc.width = field.fieldConfig.width;
                }

                if (field.isOperator) {
                    fc.isOperator = true;
                    fc.attributes = field.fieldConfig.attributes;

                }

                visibleColumns.push(fc);
            }
        }

        var objectId;
        if (this["object"] && this.object["id"]) {
            objectId = this.object.id;
        } else if (this["element"] && this.element["id"]) {
            objectId = this.element.id;
        }

        var columnConfig = {
            language: this.gridLanguage,
            pageSize: this.gridPageSize,
            selectedGridColumns: visibleColumns
        };
        var dialog = new pimcore.asset.helpers.gridConfigDialog(columnConfig, function (data, settings, save) {
                this.gridLanguage = data.language;
                this.gridPageSize = data.pageSize;
                this.createGrid(true, data.columns, settings, save);
            }.bind(this),
            function () {
                Ext.Ajax.request({
                    url: "/admin/asset-helper/grid-get-column-config",
                    params: {
                        gridtype: "grid",
                        searchType: this.searchType
                    },
                    success: function (response) {
                        response = Ext.decode(response.responseText);
                        if (response) {
                            fields = response.availableFields;
                            this.createGrid(false, fields, response.settings, false);
                            if (typeof this.saveColumnConfigButton !== "undefined") {
                                this.saveColumnConfigButton.hide();
                            }
                        } else {
                            pimcore.helpers.showNotification(t("error"), t("error_resetting_config"),
                                "error", t(rdata.message));
                        }
                    }.bind(this),
                    failure: function () {
                        pimcore.helpers.showNotification(t("error"), t("error_resetting_config"), "error");
                    }
                });
            }.bind(this),
            true,
            this.settings,
            {
                allowPreview: true,
                folderId: this.element.id
            }
        )

    },

    getGridConfig: function () {
        var config = {
            language: this.gridLanguage,
            pageSize: this.gridPageSize,
            sortinfo: this.sortinfo,
            columns: {}
        };

        var cm = this.grid.getView().getHeaderCt().getGridColumns();

        for (var i = 0; i < cm.length; i++) {
            if (cm[i].dataIndex) {
                var name = cm[i].dataIndex;
                //preview column uses data index ID
                if(cm[i].text == "Preview") {
                    name = "preview";
                }
                config.columns[name] = {
                    name: name,
                    position: i,
                    hidden: cm[i].hidden,
                    width: cm[i].width,
                    fieldConfig: this.fieldObject[name],
                    //isOperator: this.fieldObject[name].isOperator
                };
            }
        }

        return config;
    },

    getCellRenderer: function (field, value) {
        console.log(field);
        console.log(value);
        var data = store.getAt(rowIndex).data;
        var type = data.type;

        if (type == "textarea") {
            return nl2br(Ext.util.Format.htmlEncode(value));
        } else if (type == "document" || type == "asset" || type == "object") {
            if (value) {
                return '<div class="pimcore_property_droptarget">' + value + '</div>';
            } else {
                return '<div class="pimcore_property_droptarget">&nbsp;</div>';
            }
        } else if (type == "date") {
            if (value) {
                if(!(value instanceof Date)) {
                    value = new Date(value * 1000);
                }
                return Ext.Date.format(value, "Y-m-d");
            }
        } else if (type == "checkbox") {
            if (value) {
                return '<div style="text-align: left"><div role="button" class="x-grid-checkcolumn x-grid-checkcolumn-checked" style=""></div></div>';
            } else {
                return '<div style="text-align: left"><div role="button" class="x-grid-checkcolumn" style=""></div></div>';
            }
        }

        return Ext.util.Format.htmlEncode(value);
    },

    getCellEditor: function (field, defaultField ) {
        var data = field.data;

        var type = field.type;
        var property;

        if (type == "input") {
            property = Ext.create('Ext.form.TextField');
        } else if (type == "textarea") {
            property = Ext.create('Ext.form.TextArea');
        } else if (type == "document" || type == "asset" || type == "object") {
            //no editor needed here
        } else if (type == "date") {
            property = Ext.create('Ext.form.field.Date', {
                format: "Y-m-d"
            });
        } else if (type == "checkbox") {
            //no editor needed here
        } else if (type == "select") {
            if (field.layout.config) {
                var options = field.layout.config;
                property =  Ext.create('Ext.form.ComboBox', {
                    triggerAction: 'all',
                    editable: false,
                    store: options.split(",")
                });
            }

        }

        return property;
    },

    getValues : function () {

        var values = [];
        var store = this.grid.getStore();
        store.commitChanges();

        var records = store.getRange();

        for (var i = 0; i < records.length; i++) {
            var currentData = records[i];
            if (currentData) {
                var data = currentData.data.data;
                if (data && currentData.data.type == "date") {
                    data = data.valueOf() / 1000;
                }
                values.push({
                    data: data,
                    type: currentData.data.type,
                    name: currentData.data.name,
                    language: currentData.data.language
                });
            }
        }


        return values;
    },
});