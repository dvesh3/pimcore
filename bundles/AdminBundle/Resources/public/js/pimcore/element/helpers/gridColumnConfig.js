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


pimcore.registerNS("pimcore.element.helpers.gridColumnConfig");
pimcore.element.helpers.gridColumnConfig = {

    getSaveAsDialog: function () {
        var defaultName = new Date();

        var nameField = new Ext.form.TextField({
            fieldLabel: t('name'),
            length: 50,
            allowBlank: false,
            value: this.settings.gridConfigName ? this.settings.gridConfigName : defaultName
        });

        var descriptionField = new Ext.form.TextArea({
            fieldLabel: t('description'),
            // height: 200,
            value: this.settings.gridConfigDescription
        });

        var configPanel = new Ext.Panel({
            layout: "form",
            bodyStyle: "padding: 10px;",
            items: [nameField, descriptionField],
            buttons: [{
                text: t("save"),
                iconCls: "pimcore_icon_apply",
                handler: function () {
                    this.settings.gridConfigId = null;
                    this.settings.gridConfigName = nameField.getValue();
                    this.settings.gridConfigDescription = descriptionField.getValue();

                    pimcore.helpers.saveColumnConfig(this.object.id, this.classId, this.getGridConfig(), this.searchType, this.saveColumnConfigButton,
                        this.columnConfigurationSavedHandler.bind(this), this.settings, this.gridType);
                    this.saveWindow.close();
                }.bind(this)
            }]
        });

        this.saveWindow = new Ext.Window({
            width: 600,
            height: 300,
            modal: true,
            title: t('save_as_copy'),
            layout: "fit",
            items: [configPanel]
        });

        this.saveWindow.show();
        nameField.focus();
        nameField.selectText();
        return this.window;
    },

    deleteGridConfig: function () {

        Ext.MessageBox.show({
            title: t('delete'),
            msg: t('delete_message'),
            buttons: Ext.Msg.OKCANCEL,
            icon: Ext.MessageBox.INFO,
            fn: this.deleteGridConfigConfirmed.bind(this)
        });
    },

    deleteGridConfigConfirmed: function (btn) {
        if (btn == 'ok') {
            Ext.Ajax.request({
                url: "/admin/" + this.gridType + "-helper/grid-delete-column-config",
                method: "DELETE",
                params: {
                    id: this.classId,
                    objectId:
                    this.object.id,
                    gridtype: "grid",
                    gridConfigId: this.settings.gridConfigId,
                    searchType: this.searchType
                },
                success: function (response) {

                    decodedResponse = Ext.decode(response.responseText);
                    if (!decodedResponse.deleteSuccess) {
                        pimcore.helpers.showNotification(t("error"), t("error_deleting_item"), "error");
                    }

                    this.createGrid(false, response);
                }.bind(this)
            });
        }
    },

    switchToGridConfig: function (menuItem) {
        var gridConfig = menuItem.gridConfig;
        this.settings.gridConfigId = gridConfig.id;
        this.getTableDescription();
    },

    columnConfigurationSavedHandler: function (rdata) {
        this.settings = rdata.settings;
        this.availableConfigs = rdata.availableConfigs;
        this.buildColumnConfigMenu();
    },

    addGridConfigMenuItems: function(menu, list, onlyConfigs) {
        for (var i = 0; i < list.length; i++) {
            var disabled = false;
            var config = list[i];
            var text = config["name"];
            if (config.id == this.settings.gridConfigId) {
                text = this.settings.gridConfigName;
                if (!onlyConfigs) {
                    text = "<b>" + text + "</b>";
                    disabled = true;
                }
            }
            var menuConfig = {
                text: text,
                disabled: disabled,
                iconCls: 'pimcore_icon_gridcolumnconfig',
                gridConfig: config,
                handler: this.switchToGridConfig.bind(this)
            };
            menu.add(menuConfig);
        }
    },

    buildColumnConfigMenu: function (onlyConfigs) {
        var menu = this.columnConfigButton.getMenu();
        menu.removeAll();

        if (!onlyConfigs) {
            menu.add({
                text: t('save_as_copy'),
                iconCls: "pimcore_icon_save",
                handler: this.saveConfig.bind(this, true)
            });

            menu.add({
                text: t('set_as_favourite'),
                iconCls: "pimcore_icon_favourite",
                handler: function () {
                    pimcore.helpers.markColumnConfigAsFavourite(this.object.id, this.classId, this.settings.gridConfigId, this.searchType, true, this.gridType);
                }.bind(this)
            });

            menu.add({
                text: t('delete'),
                iconCls: "pimcore_icon_delete",
                disabled: !this.settings.gridConfigId || this.settings.isShared,
                handler: this.deleteGridConfig.bind(this)
            });

            menu.add('-');
        }

        var disabled = false;
        var text = t('predefined');
        if (!this.settings.gridConfigId && !onlyConfigs) {
            text = "<b>" + text + "</b>";
            disabled = true;

        }

        menu.add({
            text: text,
            iconCls: "pimcore_icon_gridcolumnconfig",
            disabled: disabled,
            gridConfig: {
                id: 0
            },
            handler: this.switchToGridConfig.bind(this)
        });

        if (this.availableConfigs && this.availableConfigs.length > 0) {
            this.addGridConfigMenuItems(menu, this.availableConfigs, onlyConfigs);
        }

        if (this.sharedConfigs && this.sharedConfigs.length > 0) {
            menu.add('-');
            this.addGridConfigMenuItems(menu, this.sharedConfigs, onlyConfigs);
        }
    },

    saveConfig: function (asCopy) {
        if (asCopy) {
            this.getSaveAsDialog();
        } else {
            pimcore.helpers.saveColumnConfig(this.object.id, this.classId, this.getGridConfig(), this.searchType, this.saveColumnConfigButton,
                this.columnConfigurationSavedHandler.bind(this), this.settings, this.gridType);
        }
    },

    filterUpdateFunction: function (grid, toolbarFilterInfo, clearFilterButton) {
        var filterStringConfig = [];
        var filterData = grid.getStore().getFilters().items;

        // reset
        toolbarFilterInfo.setTooltip(" ");

        if (filterData.length > 0) {

            for (var i = 0; i < filterData.length; i++) {

                var operator = filterData[i].getOperator();
                if (operator == 'lt') {
                    operator = "&lt;";
                } else if (operator == 'gt') {
                    operator = "&gt;";
                } else if (operator == 'eq') {
                    operator = "=";
                }

                var value = filterData[i].getValue();

                if (value instanceof Date) {
                    value = Ext.Date.format(value, "Y-m-d");
                }

                if (value && typeof value == "object") {
                    filterStringConfig.push(filterData[i].getProperty() + " " + operator + " ("
                        + value.join(" OR ") + ")");
                } else {
                    filterStringConfig.push(filterData[i].getProperty() + " " + operator + " " + value);
                }
            }

            var filterCondition = filterStringConfig.join(" AND ") + "</b>";
            toolbarFilterInfo.setTooltip("<b>" + t("filter_condition") + ": " + filterCondition);
            toolbarFilterInfo.pimcore_filter_condition = filterCondition;
            toolbarFilterInfo.setHidden(false);
        }
        toolbarFilterInfo.setHidden(filterData.length == 0);
        clearFilterButton.setHidden(!toolbarFilterInfo.isVisible());
    },

    exportPrepare: function (settings, exportType) {
        var jobs = [];
        var filters = "";
        var condition = "";
        var searchQuery = this.searchField ? this.searchField.getValue() : "";

        if (this.sqlButton && this.sqlButton.pressed) {
            condition = this.sqlEditor.getValue();
        } else {
            var filterData = this.store.getFilters().items;
            if (filterData.length > 0) {
                filters = this.store.getProxy().encodeFilters(filterData);
            }
        }

        var fields = this.getGridConfig().columns;
        var fieldKeys = Object.keys(fields);

        //create the ids array which contains chosen rows to export
        ids = [];
        var selectedRows = this.grid.getSelectionModel().getSelection();
        for (var i = 0; i < selectedRows.length; i++) {
            ids.push(selectedRows[i].data.id);
        }

        settings = Ext.encode(settings);

        var params = {
            filter: filters,
            condition: condition,
            classId: this.classId,
            folderId: this.element.id,
            objecttype: this.objecttype,
            language: this.gridLanguage,
            "ids[]": ids,
            "fields[]": fieldKeys,
            settings: settings,
            query: searchQuery,
            batch: true // to avoid limit for export
        };

        Ext.Ajax.request({
            url: this.exportPrepareUrl,
            params: params,
            success: function (response) {
                var rdata = Ext.decode(response.responseText);

                if (rdata.success && rdata.jobs) {
                    this.exportProcess(rdata.jobs, rdata.fileHandle, fieldKeys, true, settings, exportType);
                }
            }.bind(this)
        });
    },

    exportProcess: function (jobs, fileHandle, fields, initial, settings, exportType) {
        if (initial) {
            this.exportErrors = [];
            this.exportJobCurrent = 0;

            this.exportParameters = {
                fileHandle: fileHandle,
                language: this.gridLanguage,
                settings: settings
            };
            this.exportProgressBar = new Ext.ProgressBar({
                text: t('initializing'),
                style: "margin: 10px;",
                width: 500
            });

            this.exportProgressWin = new Ext.Window({
                items: [this.exportProgressBar],
                modal: true,
                bodyStyle: "background: #fff;",
                closable: false
            });
            this.exportProgressWin.show();
        }

        if (this.exportJobCurrent >= jobs.length) {
            this.exportProgressWin.close();

            // error handling
            if (this.exportErrors.length > 0) {
                var jobErrors = [];
                for (var i = 0; i < this.exportErrors.length; i++) {
                    jobErrors.push(this.exportErrors[i].job);
                }
                Ext.Msg.alert(t("error"), t("error_jobs") + ": " + jobErrors.join(","));
            } else {
                pimcore.helpers.download(exportType.downloadUrl + "?fileHandle=" + fileHandle);
            }

            return;
        }

        var status = (this.exportJobCurrent / jobs.length);
        var percent = Math.ceil(status * 100);
        this.exportProgressBar.updateProgress(status, percent + "%");

        this.exportParameters['ids[]'] = jobs[this.exportJobCurrent];
        this.exportParameters["fields[]"] = fields;
        this.exportParameters.classId = this.classId;
        this.exportParameters.initial = initial ? 1 : 0;
        this.exportParameters.language = this.gridLanguage;

        Ext.Ajax.request({
            url: this.exportProcessUrl,
            method: 'POST',
            params: this.exportParameters,
            success: function (jobs, currentJob, response) {

                try {
                    var rdata = Ext.decode(response.responseText);
                    if (rdata) {
                        if (!rdata.success) {
                            throw "not successful";
                        }
                    }
                } catch (e) {
                    this.exportErrors.push({
                        job: currentJob
                    });
                }

                window.setTimeout(function () {
                    this.exportJobCurrent++;
                    this.exportProcess(jobs, fileHandle, fields, false, settings, exportType);
                }.bind(this), 400);
            }.bind(this, jobs, jobs[this.exportJobCurrent])
        });
    },

    columnConfigurationSavedHandler: function (rdata) {
        this.settings = rdata.settings;
        this.availableConfigs = rdata.availableConfigs;
        this.buildColumnConfigMenu();
    }


};
