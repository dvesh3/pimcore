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

pimcore.registerNS("pimcore.asset.listfolder");
pimcore.asset.listfolder = Class.create(pimcore.asset.helpers.gridTabAbstract, {

    onlyDirectChildren: false,
    onlyUnreferenced: false,
    fieldObject: {},

    initialize: function (element, searchType) {
        this.element = element;
        this.searchType = searchType;

    },

    getLayout: function () {
        if (this.layout == null) {

            this.layout = new Ext.Panel({
                title: t("list"),
                iconCls: "pimcore_material_icon_list pimcore_material_icon",
                border: false,
                layout: "fit"
            });

            this.layout.on("afterrender", this.getGrid.bind(this, false));
        }

        return this.layout;
    },

    getGrid: function () {
        Ext.Ajax.request({
            url: "/admin/asset-helper/grid-get-column-config",
            params: {
                id: this.element.data.id,
                gridtype: "grid",
                type: "asset",
                gridConfigId: this.settings ? this.settings.gridConfigId : null,
                searchType: this.searchType
            },
            success: this.createGrid.bind(this, false)
        });
    },

    createGrid: function (fromConfig, response, settings, save) {
        var itemsPerPage = pimcore.helpers.grid.getDefaultPageSize(-1);

        var fields = [];

        this.filterField = new Ext.form.TextField({
            width: 200,
            style: "margin: 0 10px 0 0;",
            enableKeyEvents: true,
            value: this.preconfiguredFilter,
            listeners: {
                "keydown" : function (field, key) {
                    if (key.getKey() == key.ENTER) {
                        var input = field;
                        var proxy = this.store.baseParams.filter = input.getValue();
                        this.store.load();
                    }
                }.bind(this)
            }
        });

        if (response.responseText) {
            response = Ext.decode(response.responseText);

            if (response.pageSize) {
                itemsPerPage = response.pageSize;
            }

            fields = response.availableFields;
            this.gridLanguage = response.language;
            this.gridPageSize = response.pageSize;
            this.sortinfo = response.sortinfo;

            this.settings = response.settings || {};
            this.availableConfigs = response.availableConfigs;
            //this.sharedConfigs = response.sharedConfigs;

            if (response.onlyDirectChildren) {
                this.onlyDirectChildren = response.onlyDirectChildren;
            }

            if (response.onlyUnreferenced) {
                this.onlyUnreferenced = response.onlyUnreferenced;
            }
        } else {
             itemsPerPage = this.gridPageSize;
             fields = response;
             this.settings = settings;
             this.buildColumnConfigMenu();
        }

        this.fieldObject = {};

        for(var i = 0; i < fields.length; i++) {
            this.fieldObject[fields[i].key] = fields[i];
        }

        var fieldParam = Object.keys(this.fieldObject);

        var proxy = new Ext.data.HttpProxy({
            type: 'ajax',
            url: "/admin/asset/grid-proxy",
            reader: {
                type: 'json',
                rootProperty: 'data',
                totalProperty: 'total',
                successProperty: 'success',
                idProperty: 'key'
            },
            extraParams: {
                limit: itemsPerPage,
                folderId: this.element.data.id,
                "fields[]": fieldParam,
                language: this.gridLanguage,
                only_direct_children: this.onlyDirectChildren,
                only_unreferenced: this.onlyUnreferenced
            }
        });

        var readerFields = ['preview', 'id', 'fullpath', 'filename', 'type', 'creationDate', 'modificationDate', 'size', 'idPath'];

        this.selectionColumn = new Ext.selection.CheckboxModel();


        // var typesColumns = [
        //     {text: t("id"), sortable: true, dataIndex: 'id', editable: false, width: 60, filter: 'numeric'},
        //     {text: t("preview"), sortable: false, dataIndex: 'id', editable: false, width: 150,
        //         renderer: function (value) {
        //             if (value) {
        //                 var baseUrl = '<img src="/admin/asset/get-image-thumbnail?id=' + value;
        //                 return baseUrl + '&width=108&height=70&frame=true" />';
        //             }
        //         }.bind(this)
        //     },
        //     {text: t("filename"), sortable: true, dataIndex: 'filename', editable: false, width: 250, filter: 'string', renderer: Ext.util.Format.htmlEncode},
        //     {text: t("fullpath"), sortable: true, dataIndex: 'fullpath', editable: false, width: 250, filter: 'string', renderer: Ext.util.Format.htmlEncode},
        //     {text: t("type"), sortable: true, dataIndex: 'type', editable: false, width: 80, filter: 'string'}
        // ];
        //
        //
        // typesColumns.push({text: t("creationDate"), width: 150, sortable: true, dataIndex: 'creationDate', editable: false, filter: 'date',
        //                                                                         renderer: function(d) {
        //     var date = new Date(d * 1000);
        //     return Ext.Date.format(date, "Y-m-d H:i:s");
        // }});
        // typesColumns.push({text: t("modificationDate"), width: 150, sortable: true, dataIndex: 'modificationDate', editable: false, filter: 'date',
        //     renderer: function(d) {
        //         var date = new Date(d * 1000);
        //         return Ext.Date.format(date, "Y-m-d H:i:s");
        //     }
        // });
        //
        // typesColumns.push(
        //     {text: t("size"), sortable: false, dataIndex: 'size', editable: false}
        // );

        //this.addMetaColumns(typesColumns);
        //typesColumns = typesColumns.concat(this.getGridColumns(fields));
        typesColumns = this.getGridColumns(fields);


        this.store = new Ext.data.Store({
            proxy: proxy,
            pageSize: itemsPerPage,
            remoteSort: true,
            remoteFilter: true,
            filter: this.filterField,
            fields: readerFields
        });

        this.pagingtoolbar = pimcore.helpers.grid.buildDefaultPagingToolbar(this.store, {pageSize: itemsPerPage});

        this.checkboxOnlyDirectChildren = new Ext.form.Checkbox({
            name: "onlyDirectChildren",
            style: "margin-bottom: 5px; margin-left: 5px",
            checked: this.onlyDirectChildren,
            boxLabel: t("only_children"),
            listeners: {
                "change" : function (field, checked) {
                    this.store.getProxy().setExtraParam("only_direct_children", checked);
                    this.onlyDirectChildren = checked;

                    this.pagingtoolbar.moveFirst();
                }.bind(this)
            }
        });

        this.checkboxOnlyUnreferenced = new Ext.form.Checkbox({
            name: "onlyUnreferenced",
            style: "margin-bottom: 5px; margin-left: 5px",
            checked: this.onlyUnreferenced,
            boxLabel: t("only_unreferenced"),
            listeners: {
                "change" : function (field, checked) {
                    this.store.getProxy().setExtraParam("only_unreferenced", checked);
                    this.onlyUnreferenced = checked;

                    this.pagingtoolbar.moveFirst();
                }.bind(this)
            }
        });

        var hideSaveColumnConfig = !fromConfig || save;

        this.saveColumnConfigButton = new Ext.Button({
            tooltip: t('save_grid_options'),
            iconCls: "pimcore_icon_publish",
            hidden: hideSaveColumnConfig,
            handler: function () {
                var asCopy = !(this.settings.gridConfigId > 0);
                this.saveConfig(asCopy)
            }.bind(this)
        });

        this.columnConfigButton = new Ext.SplitButton({
            text: t('grid_options'),
            iconCls: "pimcore_icon_table_col pimcore_icon_overlay_edit",
            handler: function () {
                this.openColumnConfig(true);
            }.bind(this),
            menu: []
        });

        this.buildColumnConfigMenu();

        var exportButtons = this.getExportButtons();
        var firstButton = exportButtons.pop();

        this.exportButton = new Ext.SplitButton({
            text: firstButton.text,
            iconCls: firstButton.iconCls,
            handler: firstButton.handler,
            menu: exportButtons,
        });


        this.grid = Ext.create('Ext.grid.Panel', {
            frame: false,
            autoScroll: true,
            store: this.store,
            columnLines: true,
            stripeRows: true,
            columns : typesColumns,
            plugins: ['pimcore.gridfilters'],
            trackMouseOver: true,
            bbar: this.pagingtoolbar,
            selModel: this.selectionColumn,
            viewConfig: {
                forceFit: true
            },
            listeners: {
                activate: function() {
                    this.store.load();
                }.bind(this),
                rowdblclick: function(grid, record, tr, rowIndex, e, eOpts ) {
                    var data = this.store.getAt(rowIndex);
                    pimcore.helpers.openAsset(data.get("id"), data.get("type"));

                }.bind(this)
            },
            tbar: [
                "->"
                ,this.checkboxOnlyDirectChildren
                , "-"
                ,this.checkboxOnlyUnreferenced
                , "-"
                ,{
                    text: t("download_selected_as_zip"),
                    iconCls: "pimcore_icon_zip pimcore_icon_overlay_download",
                    handler: function () {
                        var ids = [];

                        var selectedRows = this.grid.getSelectionModel().getSelection();
                        for (var i = 0; i < selectedRows.length; i++) {
                            ids.push(selectedRows[i].data.id);
                        }

                        if(ids.length) {
                            pimcore.elementservice.downloadAssetFolderAsZip(this.element.id, ids);
                        } else {
                            Ext.Msg.alert(t('error'), t('please_select_items_to_download'));
                        }
                    }.bind(this)
                }, "-",
                this.exportButton, "-",
                this.columnConfigButton,
                this.saveColumnConfigButton
            ]
        });

        this.grid.on("rowcontextmenu", this.onRowContextmenu);

        this.layout.removeAll();
        this.layout.add(this.grid);
        this.layout.updateLayout();

        if (save) {
            if (this.settings.isShared) {
                this.settings.gridConfigId = null;
            }
            this.saveConfig(false);
        }
    },

    getGridColumns: function(fields) {
        var gridColumns = [];

        for (i = 0; i < fields.length; i++) {
            var item = fields[i];
            var key = item.name;
            var language = item.language;
            if (!key) {
                key = "";
            }
            if (!language) {
                language = "";
            }

            if (!item.type) {
                continue;
            }

            if (item.type == "system") {
                if(item.key == "preview") {
                    gridColumns.push({
                        text: t("preview"), sortable: false, dataIndex: 'id', editable: false, width: 150,
                        renderer: function (value) {
                            if (value) {
                                var baseUrl = '<img src="/admin/asset/get-image-thumbnail?id=' + value;
                                return baseUrl + '&width=108&height=70&frame=true" />';
                            }
                        }.bind(this)
                    });
                } else if (item.key == "creationDate" || item.key == "modificationDate") {
                    gridColumns.push({text: t(item.key), width: 150, sortable: true, dataIndex: item.key, editable: false, filter: 'date',
                       renderer: function(d) {
                            var date = new Date(d * 1000);
                            return Ext.Date.format(date, "Y-m-d H:i:s");
                        }
                    });
                } else if (item.key == "filename" || item.key == "fullpath") {
                    gridColumns.push({text: t(item.key), sortable: true, dataIndex: item.key, editable: false,
                        width: 250, filter: 'string', renderer: Ext.util.Format.htmlEncode});
                } else {
                    gridColumns.push({text: t(item.key),  width: 80, sortable: true,
                        dataIndex: item.key, filter: 'string'});
                }
            } else if (item.type == "date") {
                gridColumns.push({text: item.key,  width: 120, sortable: false,
                    dataIndex: item.key, filter: 'date', editable: false,
                    renderer: function(d) {
                        if (d) {
                            var date = new Date(d * 1000);
                            return Ext.Date.format(date, "Y-m-d");
                        }

                    }
                });
            } else if (item.type == "checkbox") {
                gridColumns.push(new Ext.grid.column.Check({
                    text:  item.key,
                    editable: false,
                    width: 40,
                    sortable: false,
                    filter: 'boolean',
                    dataIndex: item.key
                }));
            } else if (item.type == "select") {
                gridColumns.push({text: item.key,  width: 200, sortable: false,
                    dataIndex: item.key, filter: 'string'});
            } else {
                gridColumns.push({text: item.key,  width: 250, sortable: false,
                    dataIndex: item.key, filter: 'string'});
            }
        }

        return gridColumns;
    },

    getExportButtons: function () {
        var buttons = [];
        pimcore.globalmanager.get("pimcore.asset.gridexport").forEach(function (exportType) {
            buttons.push({
                text: t(exportType.text),
                iconCls: exportType.icon || "pimcore_icon_export",
                handler: function () {
                    pimcore.helpers.exportWarning(exportType, function (settings) {
                        this.exportPrepare(settings, exportType);
                    }.bind(this));
                }.bind(this),
            })
        }.bind(this));

        return buttons;
    },

    getGridConfig: function ($super) {
        var config = $super();
        config.onlyDirectChildren = this.onlyDirectChildren;
        config.onlyUnreferenced = this.onlyUnreferenced;
        config.pageSize = this.pagingtoolbar.pageSize;
        return config;
    },

    onRowContextmenu: function (grid, record, tr, rowIndex, e, eOpts ) {

        var menu = new Ext.menu.Menu();
        var data = grid.getStore().getAt(rowIndex);
        var selModel = grid.getSelectionModel();
        var selectedRows = selModel.getSelection();

        if (selectedRows.length <= 1) {

            menu.add(new Ext.menu.Item({
                text: t('open'),
                iconCls: "pimcore_icon_open",
                handler: function (data) {
                    pimcore.helpers.openAsset(data.data.id, data.data.type);
                }.bind(this, data)
            }));

            if (pimcore.elementservice.showLocateInTreeButton("asset")) {
                menu.add(new Ext.menu.Item({
                    text: t('show_in_tree'),
                    iconCls: "pimcore_icon_show_in_tree",
                    handler: function () {
                        try {
                            try {
                                pimcore.treenodelocator.showInTree(record.id, "asset", this);
                            } catch (e) {
                                console.log(e);
                            }

                        } catch (e2) {
                            console.log(e2);
                        }
                    }
                }));
            }
            
            menu.add(new Ext.menu.Item({
                text: t('delete'),
                iconCls: "pimcore_icon_delete",
                handler: function (data) {
                    var store = this.getStore();

                    var options = {
                        "elementType" : "asset",
                        "id": data.data.id,
                        "success": function() {
                            this.getStore().reload();
                        }.bind(this)
                    };

                    pimcore.elementservice.deleteElement(options);

                }.bind(grid, data)
            }));
        } else {
            menu.add(new Ext.menu.Item({
                text: t('open'),
                iconCls: "pimcore_icon_open",
                handler: function (data) {
                    var selectedRows = grid.getSelectionModel().getSelection();
                    for (var i = 0; i < selectedRows.length; i++) {
                        var data = selectedRows[i].data;
                        pimcore.helpers.openAsset(data.id, data.type);
                    }
                }.bind(this, data)
            }));

            menu.add(new Ext.menu.Item({
                text: t('delete'),
                iconCls: "pimcore_icon_delete",
                handler: function (data) {
                    var ids = [];
                    var selectedRows = grid.getSelectionModel().getSelection();
                    for (var i = 0; i < selectedRows.length; i++) {
                        ids.push(selectedRows[i].data.id);
                    }
                    ids = ids.join(',');

                    var options = {
                        "elementType" : "asset",
                        "id": ids,
                        "success": function() {
                            this.store.reload();
                        }.bind(this)
                    };

                    pimcore.elementservice.deleteElement(options);

                }.bind(grid, data)
            }));
        }

        e.stopEvent();
        menu.showAt(e.getXY());
    }

});

pimcore.asset.listfolder.addMethods(pimcore.asset.helpers.gridColumnConfig);