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

    systemColumns: ["id", "type", "fullpath", "filename", "creationDate", "modificationDate", "preview", "size"],
    onlyDirectChildren: false,
    onlyUnreferenced: false,
    fieldObject: {},
    object: {},
    gridType: 'asset',

    initialize: function (element, searchType) {
        this.element = element;
        this.searchType = searchType;
        this.classId = element.id;
        this.object.id = element.id;
        this.noBatchColumns = [];
        this.batchAppendColumns = [];
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

    //for parent switchToGridConfig call
    getTableDescription: function () {
        this.getGrid();
    },

    getGrid: function () {
        Ext.Ajax.request({
            url: "/admin/asset-helper/grid-get-column-config",
            params: {
                id: this.element.data.id,
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

        // this.filterField = new Ext.form.TextField({
        //     width: 200,
        //     style: "margin: 0 10px 0 0;",
        //     enableKeyEvents: true,
        //     value: this.preconfiguredFilter,
        //     listeners: {
        //         "keydown" : function (field, key) {
        //             if (key.getKey() == key.ENTER) {
        //                 var input = field;
        //                 var proxy = this.store.baseParams.filter = input.getValue();
        //                 this.store.load();
        //             }
        //         }.bind(this)
        //     }
        // });

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
            this.sharedConfigs = response.sharedConfigs;

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

        this.cellEditing = Ext.create('Ext.grid.plugin.CellEditing', {
                clicksToEdit: 1
            }
        );

        var fieldParam = Object.keys(this.fieldObject);

        var gridHelper = new pimcore.asset.helpers.grid(
            fields,
            "/admin/asset/grid-proxy",
            {
                language: this.gridLanguage,
                // limit: itemsPerPage
            },
            false
        );

        gridHelper.showSubtype = false;
        gridHelper.enableEditor = true;
        gridHelper.limit = itemsPerPage;


        //var readerFields = ['preview', 'id', 'fullpath', 'filename', 'type', 'creationDate', 'modificationDate', 'size', 'idPath'];

        //this.selectionColumn = new Ext.selection.CheckboxModel();
        //typesColumns = this.getGridColumns(fields);

        // this.store = new Ext.data.Store({
        //     proxy: proxy,
        //     autoSync: true,
        //     pageSize: itemsPerPage,
        //     remoteSort: true,
        //     remoteFilter: true,
        //     filter: this.filterField,
        //     fields: readerFields
        // });

        var existingFilters;
        if (this.store) {
            existingFilters = this.store.getFilters();
        }

        this.store = gridHelper.getStore(this.noBatchColumns, this.batchAppendColumns);
        if (this.sortinfo) {
            this.store.sort(this.sortinfo.field, this.sortinfo.direction);
        }

        this.store.getProxy().extraParams = {
            limit: itemsPerPage,
            folderId: this.element.data.id,
            "fields[]": fieldParam,
            language: this.gridLanguage,
            only_direct_children: this.onlyDirectChildren,
            only_unreferenced: this.onlyUnreferenced
        };

        this.store.setPageSize(itemsPerPage);

        if (existingFilters) {
            this.store.setFilters(existingFilters.items);
        }

        var gridColumns = gridHelper.getGridColumns();

        // add filters
        this.gridfilters = gridHelper.getGridFilters();


        this.pagingtoolbar = pimcore.helpers.grid.buildDefaultPagingToolbar(this.store, {pageSize: itemsPerPage});

        this.languageInfo = new Ext.Toolbar.TextItem({
            text: t("grid_current_language") + ": " + (this.gridLanguage == "default" ? t("default") : pimcore.available_languages[this.gridLanguage])
        });

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

        this.downloadSelectedZipButton = new Ext.Button({
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
        });

        this.grid = Ext.create('Ext.grid.Panel', {
            frame: false,
            autoScroll: true,
            store: this.store,
            columnLines: true,
            stripeRows: true,
            bodyCls: "pimcore_editable_grid",
            columns : gridColumns,
            plugins: [this.cellEditing, 'pimcore.gridfilters'],
            trackMouseOver: true,
            bbar: this.pagingtoolbar,
            selModel: gridHelper.getSelectionColumn(),
            viewConfig: {
                forceFit: true,
                enableTextSelection: true
            },
            listeners: {
                activate: function() {
                    this.store.load();
                }.bind(this),
                celldblclick: function(grid, td, cellIndex, record, tr, rowIndex, e, eOpts) {
                    var columnName = grid.ownerGrid.getColumns();
                    if(columnName[cellIndex].dataIndex == 'id' || columnName[cellIndex].dataIndex == 'fullpath'
                        || columnName[cellIndex].dataIndex == 'preview') {
                        var data = this.store.getAt(rowIndex);
                        pimcore.helpers.openAsset(data.get("id"), data.get("type"));
                    }
                }
            },
            tbar: [
                this.languageInfo, "->",
                this.checkboxOnlyDirectChildren, "-",
                this.checkboxOnlyUnreferenced, "-",
                this.downloadSelectedZipButton, "-",
                this.exportButton, "-",
                this.columnConfigButton,
                this.saveColumnConfigButton
            ]
        });

        this.grid.on("columnmove", function () {
            this.saveColumnConfigButton.show();
        }.bind(this));
        this.grid.on("columnresize", function () {
            this.saveColumnConfigButton.show();
        }.bind(this));

        this.grid.on("rowcontextmenu", this.onRowContextmenu);

        this.grid.on("afterrender", function (grid) {
            this.updateGridHeaderContextMenu(grid);
        }.bind(this));

        this.layout.removeAll();
        this.layout.add(this.grid);
        this.layout.updateLayout();

        if (save) {
            if (this.settings.isShared) {
                this.settings.gridConfigId = null;
            }
            this.saveConfig(false);
        }

        //this.grid.getView().on("refresh", this.updateRows.bind(this, "view-refresh"));
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
    },

    updateGridHeaderContextMenu: function (grid) {
        console.log('hereee!!!!!');
        var columnConfig = new Ext.menu.Item({
            text: t("grid_options"),
            iconCls: "pimcore_icon_table_col pimcore_icon_overlay_edit",
            handler: this.openColumnConfig.bind(this)
        });
        var menu = grid.headerCt.getMenu();
        menu.add(columnConfig);
        //
        var batchAllMenu = new Ext.menu.Item({
            text: t("batch_change"),
            iconCls: "pimcore_icon_table pimcore_icon_overlay_go",
            handler: function (grid) {
                menu = grid.headerCt.getMenu();
                var columnDataIndex = menu.activeHeader;
                this.batchPrepare(columnDataIndex.fullColumnIndex, false, false);
            }.bind(this, grid)
        });
        menu.add(batchAllMenu);

        var batchSelectedMenu = new Ext.menu.Item({
            text: t("batch_change_selected"),
            iconCls: "pimcore_icon_structuredTable pimcore_icon_overlay_go",
            handler: function (grid) {
                menu = grid.headerCt.getMenu();
                var columnDataIndex = menu.activeHeader;
                this.batchPrepare(columnDataIndex.fullColumnIndex, true, false);
            }.bind(this, grid)
        });
        menu.add(batchSelectedMenu);

        var batchAppendAllMenu = new Ext.menu.Item({
            text: t("batch_append_all"),
            iconCls: "pimcore_icon_table pimcore_icon_overlay_go",
            handler: function (grid) {
                menu = grid.headerCt.getMenu();
                var columnDataIndex = menu.activeHeader;
                this.batchPrepare(columnDataIndex.fullColumnIndex, false, true);
            }.bind(this, grid)
        });
        menu.add(batchAppendAllMenu);

        var batchAppendSelectedMenu = new Ext.menu.Item({
            text: t("batch_append_selected"),
            iconCls: "pimcore_icon_structuredTable pimcore_icon_overlay_go",
            handler: function (grid) {
                menu = grid.headerCt.getMenu();
                var columnDataIndex = menu.activeHeader;
                this.batchPrepare(columnDataIndex.fullColumnIndex, true, true);
            }.bind(this, grid)
        });
        menu.add(batchAppendSelectedMenu);
        //
        menu.on('beforeshow', function (batchAllMenu, batchSelectedMenu, grid) {
            var menu = grid.headerCt.getMenu();
            var columnDataIndex = menu.activeHeader.dataIndex;

            var view = grid.getView();
            // no batch for system properties
            if (Ext.Array.contains(this.systemColumns, columnDataIndex) || Ext.Array.contains(this.noBatchColumns, columnDataIndex)) {
                batchAllMenu.hide();
                batchSelectedMenu.hide();
            } else {
                batchAllMenu.show();
                batchSelectedMenu.show();
            }

            if (!Ext.Array.contains(this.systemColumns, columnDataIndex) && Ext.Array.contains(this.batchAppendColumns ? this.batchAppendColumns : [], columnDataIndex)) {
                batchAppendAllMenu.show();
                batchAppendSelectedMenu.show();
            } else {
                batchAppendAllMenu.hide();
                batchAppendSelectedMenu.hide();
            }
        }.bind(this, batchAllMenu, batchSelectedMenu, grid));
    },

    batchPrepare: function (columnIndex, onlySelected, append) {
        // no batch for system properties
        if (this.systemColumns.indexOf(this.grid.getColumns()[columnIndex].dataIndex) > -1) {
            return;
        }

        var jobs = [];
        if (onlySelected) {
            var selectedRows = this.grid.getSelectionModel().getSelection();
            for (var i = 0; i < selectedRows.length; i++) {
                jobs.push(selectedRows[i].get("id"));
            }
            this.batchOpen(columnIndex, jobs, append, true);

        } else {

            var filters = "";
            var condition = "";

            var filterData = this.store.getFilters().items;
            if (filterData.length > 0) {
                filters = this.store.getProxy().encodeFilters(filterData);
            }

            var fields = this.getGridConfig().columns;
            var fieldKeys = Object.keys(fields);

            var params = {
                filter: filters,
                condition: condition,
                classId: this.classId,
                folderId: this.element.id,
                objecttype: this.objecttype,
                "fields[]": fieldKeys,
                language: this.gridLanguage,
                batch: true //to avoid limit on batch edit/append all
            };

            Ext.Ajax.request({
                url: "/admin/asset-helper/get-batch-jobs",
                params: params,
                success: function (columnIndex, response) {
                    var rdata = Ext.decode(response.responseText);
                    if (rdata.success && rdata.jobs) {
                        this.batchOpen(columnIndex, rdata.jobs, append, false);
                    }

                }.bind(this, columnIndex)
            });
        }

    },

    batchOpen: function (columnIndex, jobs, append, onlySelected) {

        columnIndex = columnIndex - 1;

        var fieldConfig = this.grid.getColumns()[columnIndex + 1].config;
        var fieldInfo = this.fieldObject[fieldConfig.text];

        // HACK: typemapping for published (systemfields) because they have no edit masks, so we use them from the
        // data-types
        if (fieldInfo.dataIndex == "published") {
            fieldInfo.layout = {
                type: "checkbox",
                title: t("published"),
                name: "published",
            };
        }
        // HACK END

        var tagType = fieldInfo.layout.fieldtype;
        var editor = new pimcore.asset.tags[tagType](null, fieldInfo.layout);
        editor.setAsset(this.asset);
        editor.updateContext({
            containerType: "batch"
        });

        var formPanel = Ext.create('Ext.form.Panel', {
            xtype: "form",
            border: false,
            items: [editor.getLayoutEdit()],
            bodyStyle: "padding: 10px;",
            buttons: [
                {
                    text: t("save"),
                    handler: function () {
                        if (formPanel.isValid()) {
                            this.batchProcess(jobs, append, editor, fieldInfo, true);
                        }
                    }.bind(this)
                }
            ]
        });
        var batchTitle = onlySelected ? "batch_edit_field_selected" : "batch_edit_field";
        var appendTitle = onlySelected ? "batch_append_selected_to" : "batch_append_to";
        var title = append ? t(appendTitle) + " " + fieldInfo.text : t(batchTitle) + " " + fieldInfo.text;
        this.batchWin = new Ext.Window({
            autoScroll: true,
            modal: false,
            title: title,
            items: [formPanel],
            bodyStyle: "background: #fff;",
            width: 700,
            maxHeight: 600
        });
        this.batchWin.show();
        this.batchWin.updateLayout();
    },

    batchProcess: function (jobs, append, editor, fieldInfo, initial) {
        if (initial) {
            this.batchErrors = [];
            this.batchJobCurrent = 0;

            var newValue = editor.getValue();

            var valueType = "primitive";
            if (newValue && typeof newValue == "object") {
                newValue = Ext.encode(newValue);
                valueType = "object";
            }

            this.batchParameters = {
                name: fieldInfo.key,
                value: newValue,
                valueType: valueType,
                language: this.gridLanguage
            };


            this.batchWin.close();

            this.batchProgressBar = new Ext.ProgressBar({
                text: t('initializing'),
                style: "margin: 10px;",
                width: 500
            });

            this.batchProgressWin = new Ext.Window({
                items: [this.batchProgressBar],
                modal: true,
                bodyStyle: "background: #fff;",
                closable: false
            });
            this.batchProgressWin.show();

        }

        if (this.batchJobCurrent >= jobs.length) {
            this.batchProgressWin.close();
            this.pagingtoolbar.moveFirst();
            try {
                var tree = pimcore.globalmanager.get("layout_object_tree").tree;
                tree.getStore().load({
                    node: tree.getRootNode()
                });
            } catch (e) {
                console.log(e);
            }

            // error handling
            if (this.batchErrors.length > 0) {
                var jobErrors = [];
                for (var i = 0; i < this.batchErrors.length; i++) {
                    jobErrors.push(this.batchErrors[i].job + ' - ' + this.batchErrors[i].error);
                }
                Ext.Msg.alert(t("error"), t("error_jobs") + ":<br>" + jobErrors.join("<br>"));
            }

            return;
        }

        var status = (this.batchJobCurrent / jobs.length);
        var percent = Math.ceil(status * 100);
        this.batchProgressBar.updateProgress(status, percent + "%");

        this.batchParameters.job = jobs[this.batchJobCurrent];
        if (append) {
            this.batchParameters.append = 1;
        }

        Ext.Ajax.request({
            url: "/admin/asset-helper/batch",
            method: 'PUT',
            params: {
                data: Ext.encode(this.batchParameters)
            },
            success: function (jobs, currentJob, response) {

                try {
                    var rdata = Ext.decode(response.responseText);
                    if (rdata) {
                        if (!rdata.success) {
                            throw "not successful";
                        }
                    }
                } catch (e) {
                    this.batchErrors.push({
                        job: currentJob,
                        error: (typeof(rdata.message) !== "undefined" && rdata.message) ?
                            rdata.message : 'Not Successful'
                    });
                }

                window.setTimeout(function () {
                    this.batchJobCurrent++;
                    this.batchProcess(jobs, append);
                }.bind(this), 400);
            }.bind(this, jobs, this.batchParameters.job)
        });
    },

});

pimcore.asset.listfolder.addMethods(pimcore.element.helpers.gridColumnConfig);