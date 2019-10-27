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


/**
 * NOTE: This helper-methods are added to the classes pimcore.object.edit, pimcore.object.fieldcollection,
 * pimcore.object.tags.localizedfields
 */

pimcore.registerNS("pimcore.asset.helpers.grid");
pimcore.asset.helpers.grid = Class.create({

    baseParams: {},
    enableEditor: false,

    initialize: function(fields, url, baseParams) {
        this.fields = fields;

        this.url = url;
        if(baseParams) {
            this.baseParams = baseParams;
        } else {
            this.baseParams = {};
        }

        var fieldParam = [];
        for(var i = 0; i < fields.length; i++) {
            fieldParam.push(fields[i].key);
        }

        this.baseParams['fields[]'] = fieldParam;
    },

    getStore: function(noBatchColumns, batchAppendColumns) {

        batchAppendColumns = batchAppendColumns || [];
        // the store
        var readerFields = [];
        readerFields.push({name: "preview"});
        readerFields.push({name: "id"});
        readerFields.push({name: "idPath"});
        readerFields.push({name: "fullpath"});
        readerFields.push({name: "type"});
        readerFields.push({name: "subtype"});
        readerFields.push({name: "filename"});
        readerFields.push({name: "classname"});
        readerFields.push({name: "creationDate", type: 'date', dateFormat: 'timestamp'});
        readerFields.push({name: "modificationDate", type: 'date', dateFormat: 'timestamp'});
        readerFields.push({name: "size"});

        this.noBatchColumns = [];
        this.batchAppendColumns = [];

        for (var i = 0; i < this.fields.length; i++) {
            if (!in_array(this.fields[i].key, ["creationDate", "modificationDate"])) {

                var fieldConfig = this.fields[i];
                var type = fieldConfig.type;
                var key = fieldConfig.key;
                var readerFieldConfig = {name: key};
                // dynamic select returns data + options on cell level
                if (type == "select") {
                    readerFieldConfig["convert"] = function (key, v, rec) {
                        if (v && typeof v.options !== "undefined") {
                            // split it up and store the options in a separate field
                            rec.set(key + "%options", v.options, {convert: false, dirty: false});
                            return v.value;
                        }
                        return v;
                    }.bind(this, key);
                    var readerFieldConfigOptions = {name: key + "%options", persist: false};
                    readerFields.push(readerFieldConfigOptions);
                }

                if (pimcore.object.tags[type] && pimcore.object.tags[type].prototype.allowBatchAppend) {
                    batchAppendColumns.push(key);
                }

                readerFields.push(readerFieldConfig);
            }
        }

        var glue = '&';
        if(this.url.indexOf('?') === -1) {
            glue = '?';
        }

        var proxy = {
            type: 'ajax',
            url: this.url,
            reader: {
                type: 'json',
                totalProperty: 'total',
                successProperty: 'success',
                rootProperty: 'data'
            },
            api: {
                create  : this.url + glue + "xaction=create",
                read    : this.url + glue  + "xaction=read",
                update  : this.url + glue  + "xaction=update",
                destroy : this.url + glue  + "xaction=destroy"
            },
            batchActions: false,
            actionMethods: {
                create : 'POST',
                read   : 'POST',
                update : 'POST',
                destroy: 'POST'
            },
            listeners: {
                exception: function (proxy, request, operation, eOpts) {
                    if(operation.getAction() == "update") {
                        Ext.MessageBox.alert(t('error'),
                            t('cannot_save_metadata_please_try_to_edit_the_metadata_in_asset'));
                        this.store.rejectChanges();
                    }
                }.bind(this),
            },
            sync:  function(options) {
                this.store.getProxy().setExtraParam("data", this.getValues());
            }.bind(this),
            extraParams: this.baseParams
        };

        if(this.enableEditor) {
            proxy.writer = {
                type: 'json',
                //writeAllFields: true,
                rootProperty: 'data',
                encode: 'true'
            };
        }

        this.store = new Ext.data.Store({
            remoteSort: true,
            remoteFilter: true,
            autoDestroy: true,
            fields: readerFields,
            proxy: proxy,
            autoSync: true,
            listeners: {
                "beforeload": function (store) {
                    store.getProxy().abort();
                }
            }
        });

        return this.store;

    },

    selectionColumn: null,
    getSelectionColumn: function() {
        if(this.selectionColumn == null) {
            this.selectionColumn = Ext.create('Ext.selection.CheckboxModel', {});
        }
        return this.selectionColumn;
    },

    getGridColumns: function() {
        var fields = this.fields;
        var gridColumns = [];

        for (i = 0; i < fields.length; i++) {
            var field = fields[i];
            var key = field.name;
            var language = field.language;
            if (!key) {
                key = "";
            }
            if (!language) {
                language = "";
            }

            if (!field.type) {
                continue;
            }

            if (field.type == "system") {
                if (field.key == "preview") {
                    gridColumns.push({
                        text: t("preview"),
                        sortable: false,
                        dataIndex: 'preview',
                        editable: false,
                        width: this.getColumnWidth(field, 150),
                        renderer: function (value) {
                            if (value) {
                                return '<img src="' + value + '" />';
                            }
                        }.bind(this)
                    });
                } else if (field.key == "creationDate" || field.key == "modificationDate") {
                    gridColumns.push({
                        text: t(field.key),
                        width: this.getColumnWidth(field, 150),
                        sortable: true,
                        dataIndex: field.key,
                        editable: false,
                        filter: 'date',
                        renderer: function (d) {
                            var date = new Date(d * 1000);
                            return Ext.Date.format(date, "Y-m-d H:i:s");
                        }
                    });
                } else if (field.key == "filename") {
                    gridColumns.push({
                        text: t(field.key), sortable: true, dataIndex: field.key, editable: false,
                        width: this.getColumnWidth(field, 250), filter: 'string', renderer: Ext.util.Format.htmlEncode
                    });
                } else if (field.key == "fullpath") {
                    gridColumns.push({
                        text: t(field.key), sortable: true, dataIndex: field.key, editable: false,
                        width: this.getColumnWidth(field, 400), filter: 'string', renderer: Ext.util.Format.htmlEncode
                    });
                } else if (field.key == "size") {
                    gridColumns.push({
                        text: t(field.key), sortable: false, dataIndex: field.key, editable: false,
                        width: this.getColumnWidth(field, 130)
                    });
                } else {
                    gridColumns.push({
                        text: t(field.key), width: this.getColumnWidth(field, 130), sortable: true,
                        dataIndex: field.key
                    });
                }
            } else if (field.type == "date") {
                gridColumns.push({text: field.key,  width: this.getColumnWidth(field, 120), sortable: false,
                    dataIndex: field.key, filter: 'date',
                    renderer: function(d) {
                        if (d) {
                            var date = new Date(d * 1000);
                            return Ext.Date.format(date, "Y-m-d");
                        }

                    },
                    getEditor: this.getWindowCellEditor.bind(this, field)
                });
            } else if (field.type == "checkbox") {
                gridColumns.push(new Ext.grid.column.Check({
                    text:  field.key,
                    editable: false,
                    width: this.getColumnWidth(field, 40),
                    sortable: false,
                    filter: 'boolean',
                    dataIndex: field.key
                }));
            } else if (field.type == "document" || field.type == "asset" || field.type == "object") {
                gridColumns.push({text: field.key,  width: this.getColumnWidth(field, 300), sortable: false,
                    dataIndex: field.key, getEditor: this.getWindowCellEditor.bind(this, field)
                });
            } else {
                var fc = {
                    text: field.key,
                    width: this.getColumnWidth(field, 200),
                    height: '500',
                    sortable: false,
                    dataIndex: field.key,
                    filter: 'string',
                    editor: this.getCellEditor(field),
                    renderer: function (field, value) {
                        var type = field.type;
                        if (type == "textarea" && value) {
                            return nl2br(Ext.util.Format.htmlEncode(value));
                        } else if (type == "date") {
                            if (value) {
                                if(!(value instanceof Date)) {
                                    value = new Date(value * 1000);
                                }
                                return Ext.Date.format(value, "Y-m-d");
                            }
                        }

                        return Ext.util.Format.htmlEncode(value);
                    }.bind(this, field)
                };
                var fieldType = fields[i].type;
                var tag = pimcore.object.tags[fieldType];
                if (tag) {
                    //var fcLayout = tag.prototype.getGridColumnConfig(field);
                    //fc.config.layout = fields[i];
                }
                gridColumns.push(fc);
            }
        }

        return gridColumns;
    },

    getWindowCellEditor: function ( field, record) {
        return new pimcore.asset.helpers.gridCellEditor({
            fieldInfo: field
        });
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

    getGridColumns1: function() {
        // init grid-columns
        var gridColumns = [];

        var gridFilters = this.getGridFilters();

        var fields = this.fields;
        for (var i = 0; i < fields.length; i++) {
            var field = fields[i];

            if(field.key == "id") {
                gridColumns.push({text: 'ID', width: this.getColumnWidth(field, this.getColumnWidth(field, 40)), sortable: true,
                    dataIndex: 'id', filter: 'numeric'});
            } else if(field.key == "published") {
                gridColumns.push(new Ext.grid.column.Check({
                    text: t("published"),
                    width: 40,
                    sortable: true,
                    filter: 'boolean',
                    dataIndex: "published",
                    disabled: this.isSearch
                }));
            } else if(field.key == "fullpath") {
                gridColumns.push({text: t("path"), width: this.getColumnWidth(field, 200), sortable: true,
                    dataIndex: 'fullpath', filter: "string"});
            } else if(field.key == "filename") {
                gridColumns.push({text: t("filename"), width: this.getColumnWidth(field, 200), sortable: true,
                    dataIndex: 'filename'});
            } else if(field.key == "key") {
                gridColumns.push({text: t("key"), width: this.getColumnWidth(field, 200), sortable: true,
                    dataIndex: 'key', filter: 'string'});
            } else if(field.key == "classname") {
                gridColumns.push({text: t("class"), width: this.getColumnWidth(field, 200), sortable: true,
                    dataIndex: 'classname',renderer: function(v){return ts(v);}/*, hidden: true*/});
            } else if(field.key == "creationDate") {
                gridColumns.push({text: t("creationdate") + " (System)", width: this.getColumnWidth(field, 200), sortable: true,
                    dataIndex: "creationDate", filter: 'date', editable: false, renderer: function(d) {
                        return Ext.Date.format(d, "Y-m-d H:i:s");
                    }/*, hidden: !propertyVisibility.creationDate*/});
            } else if(field.key == "modificationDate") {
                gridColumns.push({text: t("modificationdate") + " (System)", width: this.getColumnWidth(field, 200), sortable: true,
                    dataIndex: "modificationDate", filter: 'date', editable: false, renderer: function(d) {

                        return Ext.Date.format(d, "Y-m-d H:i:s");
                    }/*, hidden: !propertyVisibility.modificationDate*/});
            } else {
                if (fields[i].isOperator) {
                    var operatorColumnConfig = {text: field.attributes.label ? field.attributes.label : field.attributes.key, width: field.width ? field.width : 200, sortable: false,
                        dataIndex: fields[i].key, editable: false};

                    if (field.attributes.renderer && pimcore.object.tags[field.attributes.renderer]) {
                        var tag = new pimcore.object.tags[field.attributes.renderer]({}, {});
                        var fc = tag.getGridColumnConfig({
                            key: field.attributes.key
                        });
                        operatorColumnConfig["renderer"] = fc.renderer;
                    }


                    operatorColumnConfig.getEditor = function() {
                        return new pimcore.object.helpers.gridCellEditor({
                            fieldInfo: {
                                layout: {
                                    noteditable: true
                                }
                            }
                        });
                    }.bind(this);

                    gridColumns.push(operatorColumnConfig);

                } else {
                    var fieldType = fields[i].type;
                    var tag = pimcore.object.tags[fieldType];
                    if (tag) {
                        var fc = tag.prototype.getGridColumnConfig(field);
                        fc.width = this.getColumnWidth(field, 100);

                        if (typeof gridFilters[field.key] !== 'undefined') {
                            fc.filter = gridFilters[field.key];
                        }

                        if (this.isSearch) {
                            fc.sortable = false;
                        }

                        gridColumns.push(fc);
                        gridColumns[gridColumns.length - 1].hidden = false;
                        gridColumns[gridColumns.length - 1].layout = fields[i];
                    } else {
                        console.log("could not resolve field type: " + fieldType);
                    }
                }
            }
        }

        return gridColumns;
    },

    getColumnWidth: function(field, defaultValue) {
        if (field.width) {
            return field.width;
        } else if(field.layout && field.layout.width) {
            return field.layout.width;
        } else {
            return defaultValue;
        }
    },

    getGridFilters: function() {
        var configuredFilters = {
            filter: "string",
            creationDate: "date",
            modificationDate: "date"
        };

        var fields = this.fields;
        for (var i = 0; i < fields.length; i++) {

            if(fields[i].key != "id" && fields[i].key != "published"
                && fields[i].key != "filename" && fields[i].key != "classname"
                && fields[i].key != "creationDate" && fields[i].key != "modificationDate") {

                if (fields[i].key == "fullpath") {
                    configuredFilters.fullpath = {
                        type: "string"
                    };
                } else {
                    if (fields[i].isOperator) {
                        continue;
                    }

                    if (this.isSearch && fields[i].key.startsWith("~classificationstore")) {
                        continue;
                    }

                    var fieldType = fields[i].type;
                    var tag = pimcore.object.tags[fieldType];
                    if (tag) {
                        var filter = tag.prototype.getGridColumnFilter(fields[i]);
                        if (filter) {
                            configuredFilters[filter.dataIndex] = filter;
                        }
                    } else {
                        console.log("could not resolve fieldType: " + fieldType);

                    }
                }
            }

        }


        return configuredFilters;

    },

    applyGridEvents: function(grid) {
        var fields = this.fields;
        for (var i = 0; i < fields.length; i++) {

            if (fields[i].isOperator) {
                continue;
            }

            if(fields[i].key != "id" && fields[i].key != "published" && fields[i].key != "fullpath"
                && fields[i].key != "filename" && fields[i].key != "classname"
                && fields[i].key != "creationDate" && fields[i].key != "modificationDate") {

                var fieldType = fields[i].type;
                var tag = pimcore.object.tags[fieldType];
                if (tag) {
                    tag.prototype.applyGridEvents(grid, fields[i]);
                } else {
                    console.log("could not resolve field type " + fieldType);
                }
            }

        }
    }

});
