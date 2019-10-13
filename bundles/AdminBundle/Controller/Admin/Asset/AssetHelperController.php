<?php
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

namespace Pimcore\Bundle\AdminBundle\Controller\Admin\Asset;

use PhpOffice\PhpSpreadsheet\Reader\Csv;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Pimcore\Bundle\AdminBundle\Controller\AdminController;
use Pimcore\Bundle\AdminBundle\Helper\GridHelperService;
use Pimcore\Config;
use Pimcore\DataObject\Import\Service as ImportService;
use Pimcore\Db;
use Pimcore\Localization\LocaleServiceInterface;
use Pimcore\Logger;
use Pimcore\Model\Asset;
use Pimcore\Model\DataObject;
use Pimcore\Model\FactoryInterface;
use Pimcore\Model\GridConfig;
use Pimcore\Model\GridConfigFavourite;
use Pimcore\Model\GridConfigShare;
use Pimcore\Model\ImportConfig;
use Pimcore\Model\ImportConfigShare;
use Pimcore\Model\Metadata;
use Pimcore\Model\User;
use Pimcore\Tool;
use Pimcore\Version;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\HttpFoundation\Session\Attribute\AttributeBagInterface;
use Symfony\Component\Routing\Annotation\Route;

/**
 * @Route("/asset-helper")
 */
class AssetHelperController extends AdminController
{
    const SYSTEM_COLUMNS = ['preview','id', 'type', 'fullpath', 'filename', 'creationDate', 'modificationDate', 'size'];

    /**
     * @param $userId
     * @param $classId
     * @param $searchType
     *
     * @return GridConfig\Listing
     */
    public function getMyOwnGridColumnConfigs($userId, $classId, $searchType)
    {
        $db = Db::get();
        $configListingConditionParts = [];
        $configListingConditionParts[] = 'ownerId = ' . $userId;
        $configListingConditionParts[] = 'classId = ' . $db->quote($classId);

        if ($searchType) {
            $configListingConditionParts[] = 'searchType = ' . $db->quote($searchType);
        }

        $configCondition = implode(' AND ', $configListingConditionParts);
        $configListing = new GridConfig\Listing();
        $configListing->setOrderKey('name');
        $configListing->setOrder('ASC');
        $configListing->setCondition($configCondition);
        $configListing = $configListing->load();

        return $configListing;
    }

    /**
     * @param $user User
     * @param $classId
     * @param $searchType
     *
     * @return GridConfig\Listing
     */
    public function getSharedGridColumnConfigs($user, $classId, $searchType = null)
    {
        $db = Db::get();
        $configListingConditionParts = [];
        $configListingConditionParts[] = 'sharedWithUserId = ' . $user->getId();
        $configListingConditionParts[] = 'classId = ' . $db->quote($classId);

        if ($searchType) {
            $configListingConditionParts[] = 'searchType = ' . $db->quote($searchType);
        }

        $configListing = [];

        $userIds = [$user->getId()];
        // collect all roles
        $userIds = array_merge($userIds, $user->getRoles());
        $userIds = implode(',', $userIds);
        $db = Db::get();

        $query = 'select distinct c1.id from gridconfigs c1, gridconfig_shares s 
                    where (c1.searchType = ' . $db->quote($searchType) . ' and ((c1.id = s.gridConfigId and s.sharedWithUserId IN (' . $userIds . '))) and c1.classId = ' . $db->quote($classId) . ')
                            UNION distinct select c2.id from gridconfigs c2 where shareGlobally = 1 and c2.classId = '. $db->quote($classId) . '  and c2.ownerId != ' . $db->quote($user->getId());

        $ids = $db->fetchCol($query);

        if ($ids) {
            $ids = implode(',', $ids);
            $configListing = new GridConfig\Listing();
            $configListing->setOrderKey('name');
            $configListing->setOrder('ASC');
            $configListing->setCondition('id in (' . $ids . ')');
            $configListing = $configListing->load();
        }

        return $configListing;
    }

    /**
     * @Route("/import-export-config", methods={"POST"})
     *
     * @param Request $request
     * @param ImportService $importService
     *
     * @return JsonResponse
     *
     * @throws \Exception
     */
    public function importExportConfigAction(Request $request, ImportService $importService)
    {
        $gridConfigId = $request->get('gridConfigId');

        if ($gridConfigId == -1) {
            $gridConfig = new GridConfig();
            $classId = $request->get('classId');
            $class = DataObject\ClassDefinition::getById($classId);
            // getDefaultGridFields($noSystemColumns, $class, $gridType, $noBrickColumns, $fields, $context, $objectId)

            $fields = $class->getFieldDefinitions();
            $context = ['purpose' => 'gridconfig', 'class' => $class];

            $availableColumns = $this->getDefaultGridFields(false, $class, 'grid', false, $fields, $context, null, []);
            $availableColumns = json_decode(json_encode($availableColumns), true);

            foreach ($availableColumns as &$column) {
                $fieldConfig = [
                    'key' => $column['key'],
                    'label' => $column['label'],
                    'type' => $column['type']
                ];

                $column['fieldConfig'] = $fieldConfig;
            }

            $config = [];
            $config['classId'] = $classId;
            $config['columns'] = $availableColumns;
            $gridConfig->setClassId($classId);
            $gridConfig->setConfig(json_encode($config));
        } else {
            $gridConfig = GridConfig::getById($gridConfigId);
            $user = $this->getAdminUser();
            if ($gridConfig && $gridConfig->getOwnerId() != $user->getId()) {
                $sharedGridConfigs = $this->getSharedGridColumnConfigs($this->getAdminUser(), $gridConfig->getClassId());

                if ($sharedGridConfigs) {
                    $found = false;
                    /** @var $sharedConfig GridConfigShare */
                    foreach ($sharedGridConfigs as $sharedConfig) {
                        if ($sharedConfig->getSharedWithUserId() == $this->getAdminUser()->getId()) {
                            $found = true;
                            break;
                        }
                    }
                }
            } else {
                $found = true;
            }

            if (!$found) {
                throw new \Exception('not allowed to import somebody elses config');
            }
        }

        $importConfigData = $importService->createFromExportConfig($gridConfig);
        $selectedGridColumns = $importConfigData->selectedGridColumns;

        return $this->adminJson(['success' => true, 'selectedGridColumns' => $selectedGridColumns]);
    }

    /**
     * @param ImportService $importService
     * @param $user
     * @param $classId
     *
     * @return array
     */
    private function getImportConfigs(ImportService $importService, $user, $classId)
    {
        $list = $importService->getMyOwnImportConfigs($user, $classId);

        if (!is_array($list)) {
            $list = [];
        }
        $list = array_merge($list, $importService->getSharedImportConfigs($user, $classId));
        $result = [];
        if ($list) {
            /** @var $config ImportConfig */
            foreach ($list as $config) {
                $result[] = [
                    'id' => $config->getId(),
                    'name' => $config->getName()
                ];
            }
        }

        return $result;
    }

    /**
     * @Route("/get-export-configs", methods={"GET"})
     *
     * @param Request $request
     *
     * @return JsonResponse
     */
    public function getExportConfigsAction(Request $request)
    {
        $classId = $request->get('classId');
        $list = $this->getMyOwnGridColumnConfigs($this->getAdminUser()->getId(), $classId, null);
        if (!is_array($list)) {
            $list = [];
        }
        $list = array_merge($list, $this->getSharedGridColumnConfigs($this->getAdminUser(), $classId, null));
        $result = [];

        $result[] = [
            'id' => -1,
            'name' => '--default--'
        ];

        if ($list) {
            /** @var $config Config */
            foreach ($list as $config) {
                $result[] = [
                    'id' => $config->getId(),
                    'name' => $config->getName()
                ];
            }
        }

        return $this->adminJson(['success' => true, 'data' => $result]);
    }

    /**
     * @Route("/delete-import-config", methods={"DELETE"})
     *
     * @param Request $request
     *
     * @return JsonResponse
     */
    public function deleteImportConfigAction(Request $request)
    {
        $configId = $request->get('importConfigId');
        try {
            $config = ImportConfig::getById($configId);
        } catch (\Exception $e) {
        }
        $success = false;
        if ($config) {
            if ($config->getOwnerId() != $this->getAdminUser()->getId()) {
                throw new \Exception("don't mess with someone elses grid config");
            }

            $config->delete();
            $success = true;
        }

        return $this->adminJson(['deleteSuccess' => $success]);
    }

    /**
     * @Route("/grid-delete-column-config", methods={"DELETE"})
     *
     * @param Request $request
     *
     * @return JsonResponse
     */
    public function gridDeleteColumnConfigAction(Request $request)
    {
        $gridConfigId = $request->get('gridConfigId');
        try {
            $gridConfig = GridConfig::getById($gridConfigId);
        } catch (\Exception $e) {
        }
        $success = false;
        if ($gridConfig) {
            if ($gridConfig->getOwnerId() != $this->getAdminUser()->getId()) {
                throw new \Exception("don't mess with someone elses grid config");
            }

            $gridConfig->delete();
            $success = true;
        }

        $newGridConfig = $this->doGetGridColumnConfig($request, true);
        $newGridConfig['deleteSuccess'] = $success;

        return $this->adminJson($newGridConfig);
    }

    /**
     * @Route("/grid-get-column-config", methods={"GET"})
     *
     * @param Request $request
     *
     * @return JsonResponse
     */
    public function gridGetColumnConfigAction(Request $request)
    {
        $result = $this->doGetGridColumnConfig($request);

        return $this->adminJson($result);
    }

    /**
     * @param Request $request
     * @param bool $isDelete
     *
     * @return array
     */
    public function doGetGridColumnConfig(Request $request, $isDelete = false)
    {
        $gridConfigId = null;
        $gridType = 'folder';
        if ($request->get('gridtype')) {
            $gridType = $request->get('gridtype');
        }

        $classId = $request->get('id');
        $type = $request->get('type');

        $context = ['purpose' => 'gridconfig'];

        $types = [];
        if ($request->get('types')) {
            $types = explode(',', $request->get('types'));
        }

        $userId = $this->getAdminUser()->getId();

        $requestedGridConfigId = $isDelete ? null : $request->get('gridConfigId');

        // grid config
        $gridConfig = [];
        $searchType = $request->get('searchType');

        if (strlen($requestedGridConfigId) == 0) {
            // check if there is a favourite view
            $favourite = null;
            try {
                try {
                    $favourite = GridConfigFavourite::getByOwnerAndClassAndObjectId($userId, $classId, 0, $searchType);
                } catch (\Exception $e) {
                }

                if ($favourite) {
                    $requestedGridConfigId = $favourite->getGridConfigId();
                }
            } catch (\Exception $e) {
            }
        }

        if (is_numeric($requestedGridConfigId) && $requestedGridConfigId > 0) {
            $db = Db::get();
            $configListingConditionParts = [];
            $configListingConditionParts[] = 'ownerId = ' . $userId;
            $configListingConditionParts[] = 'classId = ' . $db->quote($classId);
            $configListingConditionParts[] = 'type = ' . $db->quote($type);


            if ($searchType) {
                $configListingConditionParts[] = 'searchType = ' . $db->quote($searchType);
            }

            try {
                $savedGridConfig = GridConfig::getById($requestedGridConfigId);
            } catch (\Exception $e) {
            }

            if ($savedGridConfig) {
                try {
                    $userIds = [$this->getAdminUser()->getId()];
                    if ($this->getAdminUser()->getRoles()) {
                        $userIds = array_merge($userIds, $this->getAdminUser()->getRoles());
                    }
                    $userIds = implode(',', $userIds);
                    $shared = ($savedGridConfig->getOwnerId() != $userId && $savedGridConfig->isShareGlobally()) || $db->fetchOne('select * from gridconfig_shares where sharedWithUserId IN (' . $userIds . ') and gridConfigId = ' . $savedGridConfig->getId());

                } catch (\Exception $e) {
                }

                if (!$shared && $savedGridConfig->getOwnerId() != $this->getAdminUser()->getId()) {
                    throw new \Exception('you are neither the onwner of this config nor it is shared with you');
                }
                $gridConfigId = $savedGridConfig->getId();
                $gridConfig = $savedGridConfig->getConfig();
                $gridConfig = json_decode($gridConfig, true);
                $gridConfigName = $savedGridConfig->getName();
                $gridConfigDescription = $savedGridConfig->getDescription();
                $sharedGlobally = $savedGridConfig->isShareGlobally();
            }
        }

        $availableFields = [];

        if (empty($gridConfig)) {
            $availableFields = $this->getDefaultGridFields(
                $request->get('no_system_columns'),
                $gridType,
                $fields,
                $context,
                $types);
        } else {
            $savedColumns = $gridConfig['columns'];

            foreach ($savedColumns as $key => $sc) {
                if (!$sc['hidden']) {
                    if (in_array($key, self::SYSTEM_COLUMNS)) {
                        $type = 'system';
                    } else {
                        $type = $sc['fieldConfig']['type'];
                    }

                    $colConfig = [
                        'key' => $key,
                        'type' => $type,
                        'label' => $key,
                        'position' => $sc['position']];
                    if (isset($sc['width'])) {
                        $colConfig['width'] = $sc['width'];
                    }
                    $availableFields[] = $colConfig;
                }
            }
        }
        usort($availableFields, function ($a, $b) {
            if ($a['position'] == $b['position']) {
                return 0;
            }

            return ($a['position'] < $b['position']) ? -1 : 1;
        });

        $config = \Pimcore\Config::getSystemConfig();
        $frontendLanguages = Tool\Admin::reorderWebsiteLanguages(\Pimcore\Tool\Admin::getCurrentUser(), $config->general->validLanguages);
        if ($frontendLanguages) {
            $language = explode(',', $frontendLanguages)[0];
        } else {
            $language = $request->getLocale();
        }

        if (!Tool::isValidLanguage($language)) {
            $validLanguages = Tool::getValidLanguages();
            $language = $validLanguages[0];
        }

        if (!empty($gridConfig) && !empty($gridConfig['language'])) {
            $language = $gridConfig['language'];
        }

        if (!empty($gridConfig) && !empty($gridConfig['pageSize'])) {
            $pageSize = $gridConfig['pageSize'];
        }

        $availableConfigs = $classId ? $this->getMyOwnGridColumnConfigs($userId, $classId, $searchType) : [];
        $sharedConfigs = $classId ? $this->getSharedGridColumnConfigs($this->getAdminUser(), $classId, $searchType) : [];
        $settings = $this->getShareSettings((int)$gridConfigId);
        $settings['gridConfigId'] = (int)$gridConfigId;
        $settings['gridConfigName'] = $gridConfigName;
        $settings['gridConfigDescription'] = $gridConfigDescription;
        $settings['shareGlobally'] = $sharedGlobally;
        $settings['isShared'] = (!$gridConfigId || $shared) ? true : false;

        return [
            'sortinfo' => isset($gridConfig['sortinfo']) ? $gridConfig['sortinfo'] : false,
            'language' => $language,
            'availableFields' => $availableFields,
            'settings' => $settings,
            'onlyDirectChildren' => isset($gridConfig['onlyDirectChildren']) ? $gridConfig['onlyDirectChildren'] : false,
            'onlyUnreferenced' => isset($gridConfig['onlyUnreferenced']) ? $gridConfig['onlyUnreferenced'] : false,
            'pageSize' => isset($gridConfig['pageSize']) ? $gridConfig['pageSize'] : false,
            'availableConfigs' => $availableConfigs,
            'sharedConfigs' => $sharedConfigs

        ];
    }

    /**
     * @param $noSystemColumns
     * @param $class DataObject\ClassDefinition
     * @param $gridType
     * @param $fields
     * @param $context
     *
     * @return array
     */
    public function getDefaultGridFields($noSystemColumns, $gridType, $fields, $context, $types = [])
    {
        $count = 0;
        $availableFields = [];

        if (!$noSystemColumns) {
            foreach (self::SYSTEM_COLUMNS as $sc) {
                $key = $sc;
                if ($key == 'fullpath') {
                    $key = 'path';
                }

                if (empty($types)) {
                    $availableFields[] = [
                        'key' => $sc,
                        'type' => 'system',
                        'label' => $sc,
                        'position' => $count];
                    $count++;
                }
            }

        }

        if (is_array($fields)) {
            foreach ($fields as $key => $field) {
                if (empty($types) || in_array($field->getFieldType(), $types)) {
                    $fieldConfig = $this->getFieldGridConfig($field, $gridType, $count, !empty($types), null);
                    if (!empty($fieldConfig)) {
                        $availableFields[] = $fieldConfig;
                        $count++;
                    }
                }
            }
        }

        return $availableFields;
    }

    /**
     * @Route("/prepare-helper-column-configs", methods={"POST"})
     *
     * @param Request $request
     *
     * @return JsonResponse
     */
    public function prepareHelperColumnConfigs(Request $request)
    {
        $helperColumns = [];
        $newData = [];
        $data = json_decode($request->get('columns'));
        foreach ($data as $item) {
            if ($item->isOperator) {
                $itemKey = '#' . uniqid();

                $item->key = $itemKey;
                $newData[] = $item;
                $helperColumns[$itemKey] = $item;
            } else {
                $newData[] = $item;
            }
        }

        Tool\Session::useSession(function (AttributeBagInterface $session) use ($helperColumns) {
            $existingColumns = $session->get('helpercolumns', []);
            $helperColumns = array_merge($helperColumns, $existingColumns);
            $session->set('helpercolumns', $helperColumns);
        }, 'pimcore_gridconfig');

        return $this->adminJson(['success' => true, 'columns' => $newData]);
    }

    /**
     * @Route("/grid-mark-favourite-column-config", methods={"POST"})
     *
     * @param Request $request
     *
     * @return JsonResponse
     */
    public function gridMarkFavouriteColumnConfigAction(Request $request)
    {
        $classId = $request->get('classId');
        $asset = Asset::getById($classId);

        if ($asset->isAllowed('list')) {
            $gridConfigId = $request->get('gridConfigId');
            $searchType = $request->get('searchType');
            $type = $request->get('type');
            $global = $request->get('global');
            $user = $this->getAdminUser();

            $favourite = new GridConfigFavourite();
            $favourite->setOwnerId($user->getId());
            $favourite->setClassId($classId);
            $favourite->setSearchType($searchType);
            $favourite->setType($type);

            try {
                if ($gridConfigId != 0) {
                    $gridConfig = GridConfig::getById($gridConfigId);
                    $favourite->setGridConfigId($gridConfig->getId());
                }

                $favourite->setObjectId(0);
                $favourite->save();

                $specializedConfigs = false;
            } catch (\Exception $e) {
                $favourite->delete();
            }

            return $this->adminJson(['success' => true, 'spezializedConfigs' => $specializedConfigs]);
        }

        throw $this->createAccessDeniedHttpException();
    }

    /**
     * @param $gridConfigId
     *
     * @return array
     */
    protected function getShareSettings($gridConfigId)
    {
        $result = [
            'sharedUserIds' => [],
            'sharedRoleIds' => []
        ];

        $db = Db::get();
        $allShares = $db->fetchAll('select s.sharedWithUserId, u.type from gridconfig_shares s, users u 
                      where s.sharedWithUserId = u.id and s.gridConfigId = ' . $gridConfigId);

        if ($allShares) {
            foreach ($allShares as $share) {
                $type = $share['type'];
                $key = 'shared' . ucfirst($type) . 'Ids';
                $result[$key][] = $share['sharedWithUserId'];
            }
        }

        foreach ($result as $idx => $value) {
            $value = $value ? implode(',', $value) : '';
            $result[$idx] = $value;
        }

        return $result;
    }

    /**
     * @Route("/import-save-config", methods={"POST"})
     *
     * @param Request $request
     * @param ImportService $importService
     *
     * @return JsonResponse
     */
    public function importSaveConfigAction(Request $request, ImportService $importService)
    {
        try {
            $classId = $request->get('classId');
            $configData = $request->get('config');
            $configData = json_decode($configData, true);

            $configData['pimcore_version'] = Version::getVersion();
            $configData['pimcore_revision'] = Version::getRevision();

            $importConfigId = $request->get('importConfigId');
            if ($importConfigId) {
                try {
                    $importConfig = ImportConfig::getById($importConfigId);
                } catch (\Exception $e) {
                }
            }
            if ($importConfig && $importConfig->getOwnerId() != $this->getAdminUser()->getId()) {
                throw new \Exception("don't mess around with somebody elses configuration");
            }

            if (!$importConfig) {
                $importConfig = new ImportConfig();
                $importConfig->setName(date('c'));
                $importConfig->setClassId($classId);
                $importConfig->setOwnerId($this->getAdminUser()->getId());
            }

            if ($configData) {
                unset($configData['importConfigId']);
                $name = $configData['shareSettings']['configName'];
                $description = $configData['shareSettings']['configDescription'];
                $importConfig->setName($name);
                $importConfig->setDescription($description);
                $importConfig->setShareGlobally($configData['shareSettings']['shareGlobally'] && $this->getAdminUser()->isAdmin());
            }

            $configDataEncoded = json_encode($configData);
            $importConfig->setConfig($configDataEncoded);
            $importConfig->save();

            $this->updateImportConfigShares($importConfig, $configData);

            return $this->adminJson(['success' => true,
                    'importConfigId' => $importConfig->getId(),
                    'availableConfigs' => $this->getImportConfigs($importService, $this->getAdminUser(), $classId)
                ]
            );
        } catch (\Exception $e) {
            return $this->adminJson(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    /**
     * @Route("/grid-save-column-config", methods={"POST"})
     *
     * @param Request $request
     *
     * @return JsonResponse
     */
    public function gridSaveColumnConfigAction(Request $request)
    {
        $asset = Asset::getById($request->get('id'));

        if ($asset->isAllowed('list')) {

            try {
                $classId = $request->get('class_id');
                $searchType = $request->get('searchType');
                $type = $request->get('type');

                // grid config
                $gridConfigData = $this->decodeJson($request->get('gridconfig'));
                $gridConfigData['pimcore_version'] = Version::getVersion();
                $gridConfigData['pimcore_revision'] = Version::getRevision();
                unset($gridConfigData['settings']['isShared']);

                $metadata = $request->get('settings');
                $metadata = json_decode($metadata, true);

                $gridConfigId = $metadata['gridConfigId'];
                if ($gridConfigId) {
                    try {
                        $gridConfig = GridConfig::getById($gridConfigId);
                    } catch (\Exception $e) {
                    }
                }
                if ($gridConfig && $gridConfig->getOwnerId() != $this->getAdminUser()->getId()) {
                    throw new \Exception("don't mess around with somebody else's configuration");
                }

                $this->updateGridConfigShares($gridConfig, $metadata);

                if (!$gridConfig) {
                    $gridConfig = new GridConfig();
                    $gridConfig->setName(date('c'));
                    $gridConfig->setClassId($classId);
                    $gridConfig->setSearchType($searchType);
                    $gridConfig->setType($type);

                    $gridConfig->setOwnerId($this->getAdminUser()->getId());
                }

                if ($metadata) {
                    $gridConfig->setName($metadata['gridConfigName']);
                    $gridConfig->setDescription($metadata['gridConfigDescription']);
                    $gridConfig->setShareGlobally($metadata['shareGlobally'] && $this->getAdminUser()->isAdmin());
                }

                $gridConfigData = json_encode($gridConfigData);
                $gridConfig->setConfig($gridConfigData);
                $gridConfig->save();

                $userId = $this->getAdminUser()->getId();

                $availableConfigs = $this->getMyOwnGridColumnConfigs($userId, $classId, $searchType);
                $sharedConfigs = $this->getSharedGridColumnConfigs($this->getAdminUser(), $classId, $searchType);

                $settings = $this->getShareSettings($gridConfig->getId());
                $settings['gridConfigId'] = (int)$gridConfig->getId();
                $settings['gridConfigName'] = $gridConfig->getName();
                $settings['gridConfigDescription'] = $gridConfig->getDescription();
                $settings['shareGlobally'] = $gridConfig->isShareGlobally();
                $settings['isShared'] = !$gridConfig || ($gridConfig->getOwnerId() != $this->getAdminUser()->getId());

                return $this->adminJson(['success' => true,
                        'settings' => $settings,
                        'availableConfigs' => $availableConfigs,
                        'sharedConfigs' => $sharedConfigs,
                    ]
                );
            } catch (\Exception $e) {
                return $this->adminJson(['success' => false, 'message' => $e->getMessage()]);
            }
        }

        throw $this->createAccessDeniedHttpException();
    }

    /**
     * @param $importConfig ImportConfig
     * @param $metadata
     *
     * @throws \Exception
     */
    protected function updateImportConfigShares($importConfig, $configData)
    {
        $user = $this->getAdminUser();
        if (!$importConfig || !$user->isAllowed('share_configurations')) {
            // nothing to do
            return;
        }

        if ($importConfig->getOwnerId() != $this->getAdminUser()->getId()) {
            throw new \Exception("don't mess with someone elses grid config");
        }
        $combinedShares = [];
        $sharedUserIds = $configData['shareSettings'] ? $configData['shareSettings']['sharedUserIds'] : [];
        $sharedRoleIds = $configData['shareSettings'] ? $configData['shareSettings']['sharedRoleIds'] : [];

        if ($sharedUserIds) {
            $combinedShares = explode(',', $sharedUserIds);
        }

        if ($sharedRoleIds) {
            $sharedRoleIds = explode(',', $sharedRoleIds);
            $combinedShares = array_merge($combinedShares, $sharedRoleIds);
        }

        $db = Db::get();
        $db->delete('importconfig_shares', ['importConfigId' => $importConfig->getId()]);

        foreach ($combinedShares as $id) {
            $share = new ImportConfigShare();
            $share->setImportConfigId($importConfig->getId());
            $share->setSharedWithUserId($id);
            $share->save();
        }
    }

    /**
     * @param $gridConfig GridConfig
     * @param $metadata
     *
     * @throws \Exception
     */
    protected function updateGridConfigShares($gridConfig, $metadata)
    {
        $user = $this->getAdminUser();
        if (!$gridConfig || !$user->isAllowed('share_configurations')) {
            // nothing to do
            return;
        }

        if ($gridConfig->getOwnerId() != $this->getAdminUser()->getId()) {
            throw new \Exception("don't mess with someone elses grid config");
        }
        $combinedShares = [];
        $sharedUserIds = $metadata['sharedUserIds'];
        $sharedRoleIds = $metadata['sharedRoleIds'];

        if ($sharedUserIds) {
            $combinedShares = explode(',', $sharedUserIds);
        }

        if ($sharedRoleIds) {
            $sharedRoleIds = explode(',', $sharedRoleIds);
            $combinedShares = array_merge($combinedShares, $sharedRoleIds);
        }

        $db = Db::get();
        $db->delete('gridconfig_shares', ['gridConfigId' => $gridConfig->getId()]);

        foreach ($combinedShares as $id) {
            $share = new GridConfigShare();
            $share->setGridConfigId($gridConfig->getId());
            $share->setSharedWithUserId($id);
            $share->save();
        }
    }

    /**
     * @param $field
     * @param $gridType
     * @param $position
     * @param bool $force
     * @param null $keyPrefix
     *
     * @return array|null
     */
    protected function getFieldGridConfig($field, $gridType, $position, $force = false, $keyPrefix = null)
    {
        $key = $keyPrefix . $field->getName();
        $config = null;
        $title = $field->getName();
        if (method_exists($field, 'getTitle')) {
            if ($field->getTitle()) {
                $title = $field->getTitle();
            }
        }


        if (method_exists($field, 'getWidth')) {
            $config['width'] = $field->getWidth();
        }
        if (method_exists($field, 'getHeight')) {
            $config['height'] = $field->getHeight();
        }

        $visible = false;
        if ($gridType == 'search') {
            $visible = $field->getVisibleSearch();
        } elseif ($gridType == 'grid') {
            $visible = $field->getVisibleGridView();
        } elseif ($gridType == 'all') {
            $visible = true;
        }

        if (!$field->getInvisible() && ($force || $visible)) {
            $context = ['purpose' => 'gridconfig'];

            $result = [
                'key' => $key,
                'type' => $field->getFieldType(),
                'label' => $title,
                'config' => $config,
                'layout' => $field,
                'position' => $position
            ];

            return $result;
        } else {
            return null;
        }
    }

    /**
     * @param Request $request
     *
     * @return mixed|string
     */
    protected function extractLanguage(Request $request)
    {
        $requestedLanguage = $request->get('language');
        if ($requestedLanguage) {
            if ($requestedLanguage != 'default') {
                $request->setLocale($requestedLanguage);
            }
        } else {
            $requestedLanguage = $request->getLocale();
        }

        return $requestedLanguage;
    }

    /**
     * @Route("/get-export-jobs", methods={"GET"})
     *
     * @param Request $request
     * @param EventDispatcherInterface $eventDispatcher
     *
     * @return JsonResponse
     */
    public function getExportJobsAction(Request $request, GridHelperService $gridHelperService)
    {

        $allParams = array_merge($request->request->all(), $request->query->all());
        $list = $gridHelperService->prepareAssetListingForGrid($allParams, $this->getAdminUser());

        if(empty($ids = $allParams["ids"])) {
            $ids = $list->loadIdList();
        }

        $jobs = array_chunk($ids, 20);

        $fileHandle = uniqid('asset-export-');
        file_put_contents($this->getCsvFile($fileHandle), '');

        return $this->adminJson(['success' => true, 'jobs' => $jobs, 'fileHandle' => $fileHandle]);
    }

    /**
     * @Route("/do-export", methods={"POST"})
     *
     * @param Request $request
     * @param LocaleServiceInterface $localeService
     *
     * @return JsonResponse
     */
    public function doExportAction(Request $request, LocaleServiceInterface $localeService)
    {
        $fileHandle = \Pimcore\File::getValidFilename($request->get('fileHandle'));
        $ids = $request->get('ids');
        $settings = $request->get('settings');
        $settings = json_decode($settings, true);
        $delimiter = $settings['delimiter'] ? $settings['delimiter'] : ';';

        $listClass = '\\Pimcore\\Model\\Asset\\Listing';

        /**
         * @var $list \Pimcore\Model\DataObject\Listing
         */
        $list = new $listClass();

        $quotedIds = [];
        foreach ($ids as $id) {
            $quotedIds[] = $list->quote($id);
        }

        //$list->setObjectTypes(['object', 'folder', 'variant']);
        $list->setCondition('id IN (' . implode(',', $quotedIds) . ')');
        $list->setOrderKey(' FIELD(id, ' . implode(',', $quotedIds) . ')', false);

        $fields = $request->get('fields');

        $addTitles = $request->get('initial');

        $csv = $this->getCsvData($request, $localeService, $list, $fields, $addTitles);

        $fp = fopen($this->getCsvFile($fileHandle), 'a');

        $firstLine = true;
        foreach ($csv as $line) {
            if ($addTitles && $firstLine) {
                $firstLine = false;
                $line = implode($delimiter, $line) . "\r\n";
                fwrite($fp, $line);
            } else {
                fputs($fp, implode($delimiter, array_map([$this, 'encodeFunc'], $line)) . "\r\n");
            }
        }

        fclose($fp);

        return $this->adminJson(['success' => true]);
    }

    public function encodeFunc($value)
    {
        $value = str_replace('"', '""', $value);
        //force wrap value in quotes and return
        return '"' . $value . '"';
    }

    /**
     * @param Request $request
     * @param LocaleServiceInterface $localeService
     * @param $list
     * @param $fields
     * @param bool $addTitles
     *
     * @return string
     */
    protected function getCsvData(Request $request, LocaleServiceInterface $localeService, $list, $fields, $addTitles = true)
    {
        //create csv
        $csv = [];

        if ($addTitles) {
            $columns = $fields;
            foreach ($columns as $columnIdx => $columnKey) {
                $columns[$columnIdx] = '"' . $columnKey . '"';
            }
            $csv[] = $columns;
        }

        foreach ($list->load() as $asset) {
            if ($fields) {
                $a = [];
                foreach ($fields as $field) {
                    $getter = 'get' . ucfirst($field);

                    if (method_exists($asset, $getter)) {
                        $a[] = $asset->$getter();
                    } else {
                        $a[] = $asset->getMetadata($field);
                    }
                }
                $csv[] = $a;
            }
        }

        return $csv;
    }

    /**
     * @param $fileHandle
     *
     * @return string
     */
    protected function getCsvFile($fileHandle)
    {
        return PIMCORE_SYSTEM_TEMP_DIRECTORY . '/' . $fileHandle . '.csv';
    }

    /**
     * @Route("/download-csv-file", methods={"GET"})
     *
     * @param Request $request
     *
     * @return BinaryFileResponse
     */
    public function downloadCsvFileAction(Request $request)
    {
        $fileHandle = \Pimcore\File::getValidFilename($request->get('fileHandle'));
        $csvFile = $this->getCsvFile($fileHandle);
        if (file_exists($csvFile)) {
            $response = new BinaryFileResponse($csvFile);
            $response->headers->set('Content-Type', 'application/csv');
            $response->setContentDisposition(ResponseHeaderBag::DISPOSITION_ATTACHMENT, 'export.csv');
            $response->deleteFileAfterSend(true);

            return $response;
        }
    }

    /**
     * @Route("/download-xlsx-file", methods={"GET"})
     *
     * @param Request $request
     *
     * @return BinaryFileResponse
     */
    public function downloadXlsxFileAction(Request $request)
    {
        $fileHandle = \Pimcore\File::getValidFilename($request->get('fileHandle'));
        $csvFile = $this->getCsvFile($fileHandle);
        if (file_exists($csvFile)) {
            $csvReader = new Csv();
            $csvReader->setDelimiter(';');
            $csvReader->setEnclosure('""');
            $csvReader->setSheetIndex(0);

            $spreadsheet = $csvReader->load($csvFile);
            $writer = new Xlsx($spreadsheet);
            $xlsxFilename = PIMCORE_SYSTEM_TEMP_DIRECTORY. '/' .$fileHandle. '.xlsx';
            $writer->save($xlsxFilename);

            $response = new BinaryFileResponse($xlsxFilename);
            $response->headers->set('Content-Type', 'application/xlsx');
            $response->setContentDisposition(ResponseHeaderBag::DISPOSITION_ATTACHMENT, 'export.xlsx');
            $response->deleteFileAfterSend(true);

            return $response;
        }
    }

    /**
     * @param Request $request
     * @param $field
     * @param $object DataObject\AbstractObject
     * @param $requestedLanguage
     *
     * @return mixed
     */
    protected function getCsvFieldData(Request $request, $field, $object, $requestedLanguage, $helperDefinitions)
    {
        //check if field is systemfield
        $systemFieldMap = [
            'id' => 'getId',
            'fullpath' => 'getRealFullPath',
            'published' => 'getPublished',
            'creationDate' => 'getCreationDate',
            'modificationDate' => 'getModificationDate',
            'filename' => 'getKey',
            'key' => 'getKey',
            'classname' => 'getClassname'
        ];
        if (in_array($field, array_keys($systemFieldMap))) {
            $getter = $systemFieldMap[$field];

            return $object->$getter();
        } else {
            //check if field is standard object field
            $fieldDefinition = $object->getClass()->getFieldDefinition($field);
            if ($fieldDefinition) {
                return $fieldDefinition->getForCsvExport($object);
            } else {
                $fieldParts = explode('~', $field);

                // check for objects bricks and localized fields
                if (DataObject\Service::isHelperGridColumnConfig($field)) {
                    if ($helperDefinitions[$field]) {
                        return DataObject\Service::calculateCellValue($object, $helperDefinitions, $field, ['language' => $requestedLanguage]);
                    }
                } elseif (substr($field, 0, 1) == '~') {
                    $type = $fieldParts[1];

                    if ($type == 'classificationstore') {
                        $fieldname = $fieldParts[2];
                        $groupKeyId = explode('-', $fieldParts[3]);
                        $groupId = $groupKeyId[0];
                        $keyId = $groupKeyId[1];
                        $getter = 'get' . ucfirst($fieldname);
                        if (method_exists($object, $getter)) {
                            $keyConfig = DataObject\Classificationstore\KeyConfig::getById($keyId);
                            $type = $keyConfig->getType();
                            $definition = json_decode($keyConfig->getDefinition());
                            $fieldDefinition = \Pimcore\Model\DataObject\Classificationstore\Service::getFieldDefinitionFromJson($definition, $type);

                            /** @var $csFieldDefinition DataObject\ClassDefinition\Data\Classificationstore */
                            $csFieldDefinition = $object->getClass()->getFieldDefinition($fieldname);
                            $csLanguage = $requestedLanguage;
                            if (!$csFieldDefinition->isLocalized()) {
                                $csLanguage = 'default';
                            }

                            return $fieldDefinition->getForCsvExport(
                                $object,
                                ['context' => [
                                    'containerType' => 'classificationstore',
                                    'fieldname' => $fieldname,
                                    'groupId' => $groupId,
                                    'keyId' => $keyId,
                                    'language' => $csLanguage
                                ]]
                            );
                        }
                    }
                    //key value store - ignore for now
                } elseif (count($fieldParts) > 1) {
                    // brick
                    $brickType = $fieldParts[0];

                    if (strpos($brickType, '?') !== false) {
                        $brickDescriptor = substr($brickType, 1);
                        $brickDescriptor = json_decode($brickDescriptor, true);
                        $innerContainer = $brickDescriptor['innerContainer'] ? $brickDescriptor['innerContainer'] : 'localizedfields';
                        $brickType = $brickDescriptor['containerKey'];
                    }
                    $brickKey = $fieldParts[1];

                    $key = DataObject\Service::getFieldForBrickType($object->getClass(), $brickType);

                    $brickClass = DataObject\Objectbrick\Definition::getByKey($brickType);

                    if ($brickDescriptor) {
                        $localizedFields = $brickClass->getFieldDefinition($innerContainer);
                        $fieldDefinition = $localizedFields->getFieldDefinition($brickDescriptor['brickfield']);
                    } else {
                        $fieldDefinition = $brickClass->getFieldDefinition($brickKey);
                    }

                    if ($fieldDefinition) {
                        $brickContainer = $object->{'get' . ucfirst($key)}();
                        if ($brickContainer && !empty($brickKey)) {
                            $brick = $brickContainer->{'get' . ucfirst($brickType)}();
                            if ($brick) {
                                $params = [
                                    'context' => [
                                        'containerType' => 'objectbrick',
                                        'containerKey' => $brickType,
                                        'fieldname' => $brickKey
                                    ]

                                ];

                                $value = $brick;

                                if ($brickDescriptor) {
                                    $innerContainer = $brickDescriptor['innerContainer'] ? $brickDescriptor['innerContainer'] : 'localizedfields';
                                    $value = $brick->{'get' . ucfirst($innerContainer)}();
                                }

                                return $fieldDefinition->getForCsvExport($value, $params);
                            }
                        }
                    }
                } elseif ($locFields = $object->getClass()->getFieldDefinition('localizedfields')) {

                    // if the definition is not set try to get the definition from localized fields
                    $fieldDefinition = $locFields->getFieldDefinition($field);
                    if ($fieldDefinition) {
                        $needLocalizedPermissions = true;

                        return $fieldDefinition->getForCsvExport($object->getLocalizedFields(), ['language' => $request->get('language')]);
                    }
                }
            }
        }
    }

    /**
     * Flattens object data to an array with key=>value where
     * value is simply a string representation of the value (for objects, hrefs and assets the full path is used)
     *
     * @param DataObject\AbstractObject $object
     *
     * @return array
     */
    protected function csvObjectData($object)
    {
        $o = [];
        foreach ($object->getClass()->getFieldDefinitions() as $key => $value) {
            //exclude remote owner fields
            if (!($value instanceof DataObject\ClassDefinition\Data\Relations\AbstractRelations and $value->isRemoteOwner())) {
                $o[$key] = $value->getForCsvExport($object);
            }
        }

        $o['id (system)'] = $object->getId();
        $o['key (system)'] = $object->getKey();
        $o['fullpath (system)'] = $object->getRealFullPath();
        $o['published (system)'] = $object->isPublished();
        $o['type (system)'] = $object->getType();

        return $o;
    }

    /**
     * @Route("/get-metadata-for-column-config", methods={"GET"})
     *
     * @param Request $request
     *
     * @return JsonResponse
     */
    public function getMetadataForColumnConfigAction(Request $request)
    {
        $result = [];

        //default metadata
        $defaultMetataNames = ['copyright', 'source', 'title'];
        foreach ($defaultMetataNames as $defaultMetata) {
            $defaultColumns[] = ['title' => $defaultMetata, 'name' => $defaultMetata, 'datatype' => 'data', 'fieldtype' => 'input'];
        }
        $result['defaultColumns']['nodeLabel'] = 'default_metadata';
        $result['defaultColumns']['nodeType'] = 'image';
        $result['defaultColumns']['childs'] = $defaultColumns;

        //predefined metadata
        $list = Metadata\Predefined\Listing::getByTargetType("asset",null);
        $metadataItems = [];
        foreach ($list as $idx => $item) {
            /** @var $item Metadata\Predefined */
            $item->expand();
            $metadataItems[$idx]['title'] = $item->getName();
            $metadataItems[$idx]['name'] = $item->getName();
            $metadataItems[$idx]['subtype'] = $item->getTargetSubtype();
            $metadataItems[$idx]['datatype'] = "data";
            $metadataItems[$idx]['fieldtype'] = $item->getType();
        }

        $result['metadataColumns']['childs'] = $metadataItems;
        $result['metadataColumns']['nodeLabel'] = 'predefined_metadata';
        $result['metadataColumns']['nodeType'] = 'metadata';


        //system columns
        $systemColumnNames = self::SYSTEM_COLUMNS;
        $systemColumns = [];
        foreach ($systemColumnNames as $systemColumn) {
            $systemColumns[] = ['title' => $systemColumn, 'name' => $systemColumn, 'datatype' => 'data', 'fieldtype' => 'system'];
        }
        $result['systemColumns']['nodeLabel'] = 'system_columns';
        $result['systemColumns']['nodeType'] = 'system';
        $result['systemColumns']['childs'] = $systemColumns;

        return $this->adminJson($result);
    }
}
