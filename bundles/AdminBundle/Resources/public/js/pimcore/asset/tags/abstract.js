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

pimcore.registerNS("pimcore.asset.tags.abstract");
pimcore.asset.tags.abstract = Class.create({

    asset:null,
    name:null,
    title:"",
    initialData:null,

    setAsset:function (asset) {
        this.asset = asset;
    },

    getAsset:function () {
        return this.asset;
    },

    setName:function (name) {
        this.name = name;
        this.context.fieldname = name;
    },

    getName:function () {
        return this.name;
    },

    setTitle:function (title) {
        this.title = title;
    },

    getTitle:function () {
        return this.title;
    },

    setInitialData:function (initialData) {
        this.initialData = initialData;
    },

    getInitialData:function () {
        return this.initialData;
    },

    getGridColumnEditor:function (field) {
        return null;
    },

    getGridColumnConfig:function (field) {
        var renderer = function (key, value, metaData, record) {
            return Ext.util.Format.htmlEncode(value);
        }.bind(this, field.key);

        return {text:ts(field.label), sortable:true, dataIndex:field.key, renderer:renderer,
            editor:this.getGridColumnEditor(field)};
    },

    getGridColumnFilter:function (field) {
        return null;
    },

    applyGridEvents: function(grid, field) {
        //nothing to do here, but maybe in sub types
    },

    getContext: function() {
        this.createDefaultContext();
        return this.context;
    },

    updateContext: function(context) {
        this.createDefaultContext();
        Ext.apply(this.context, context);
    },

    createDefaultContext: function() {
        if (typeof this.context === "undefined") {
            this.context = {
                containerType: "object",
                fieldname: null
            };
        }
    },

    getWindowCellEditor: function ( field, record) {
        return new pimcore.asset.helpers.gridCellEditor({
            fieldInfo: field
        });
    },

    isRendered:function () {
        if (this.component) {
            return this.component.rendered;
        }

        throw "it seems that the field -" + this.getName()
        + "- does not implement the isRendered() method and doesn't contain this.component";
    },

});