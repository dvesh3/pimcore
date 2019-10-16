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

pimcore.registerNS("pimcore.gridexport.xlsx");
pimcore.gridexport.xlsx = Class.create(pimcore.gridexport.abstract, {
    name: "xlsx",
    text: t("export_xlsx"),
    downloadUrl: "/admin/object-helper/download-xlsx-file",
    getObjectSettingsContainer: function () {
        var enableInheritance = new Ext.form.Checkbox({
            fieldLabel: t('enable_inheritance'),
            name: 'enableInheritance',
            inputValue: true,
            labelWidth: 200
        });

        return new Ext.form.FieldSet({
            title: t('object_settings'),
            items: [
                enableInheritance
            ]
        });
    }
});

pimcore.globalmanager.get("pimcore.gridexport").push(new pimcore.gridexport.xlsx())