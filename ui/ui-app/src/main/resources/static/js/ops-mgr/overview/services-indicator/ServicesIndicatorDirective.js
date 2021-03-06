define(["require", "exports", "angular", "../module-name", "underscore", "moment", "pascalprecht.translate"], function (require, exports, angular, module_name_1, _, moment) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Indicator = /** @class */ (function () {
        function Indicator(chartOptions, $filter) {
            this.chartOptions = chartOptions;
            this.$filter = $filter;
            this.chartData = [];
            this.openAlerts = [];
            this.allServices = [];
            this.counts = { errorCount: 0, allCount: 0, upCount: 0, downCount: 0, warningCount: 0 };
            this.percent = 0;
            this.dateTime = null;
            this.grouped = {
                "HEALTHY": { label: "Healthy", styleClass: "status-healthy", count: 0, data: [] },
                "WARNING": { label: "Warnings", styleClass: "status-warnings", count: 0, data: [] },
                "UNHEALTHY": { label: "UNHEALTHY", styleClass: "status-errors", count: 0, data: [] }
            };
            this.chartData.push({ key: "HEALTHY", value: 0 });
            this.chartData.push({ key: "UNHEALTHY", value: 0 });
            this.chartData.push({ key: "WARNING", value: 0 });
        }
        Indicator.prototype.toggleComponentAlert = function (event, component) {
            var target = event.target;
            var parentTdWidth = $(target).parents('td:first').width();
            component.alertDetailsStyle = 'width:' + parentTdWidth + 'px;';
            if (component.showAlerts == true) {
                var alertIndex = _.indexOf(this.openAlerts, component);
                if (alertIndex >= 0) {
                    this.openAlerts.splice(alertIndex, 1);
                }
                component.showAlerts = false;
            }
            else {
                this.openAlerts.push(component);
                component.showAlerts = true;
            }
        };
        Indicator.prototype.reset = function () {
            this.openAlerts = [];
            this.counts = { errorCount: 0, allCount: 0, upCount: 0, downCount: 0, warningCount: 0 };
            this.percent = 0;
            this.dateTime = null;
            this.allServices = [];
            angular.forEach(this.grouped, function (groupData, status) {
                groupData.data = [];
                groupData.count = 0;
            });
        };
        Indicator.prototype.addService = function (service) {
            var displayState = service.state == "UP" ? "HEALTHY" : (service.state == "DOWN" ? "UNHEALTHY" : service.state);
            this.grouped[displayState].data.push(service);
            this.grouped[displayState].count++;
            service.latestAlertTimeAgo = null;
            //update timeAgo text
            if (service.latestAlertTimestamp != null) {
                service.latestAlertTimeAgo = moment(service.latestAlertTimestamp).from(moment());
            }
        };
        Indicator.prototype.checkToShowClusterName = function (service) {
            if (service && service.components) {
                var componentNames = _.map(service.components, function (component) {
                    return component.name;
                });
                var unique = _.uniq(componentNames);
                if (componentNames.length != unique.length) {
                    service.showClusterName = true;
                }
                else {
                    service.showClusterName = false;
                }
            }
        };
        Indicator.prototype.addServices = function (services) {
            var _this = this;
            if (this.openAlerts.length == 0) {
                this.reset();
                this.allServices = services;
                angular.forEach(services, function (service, i) {
                    _this.addService(service);
                    service.componentCount = service.components.length;
                    service.healthyComponentCount = service.healthyComponents.length;
                    service.unhealthyComponentCount = service.unhealthyComponents.length;
                    _this.checkToShowClusterName(service);
                });
                this.updateCounts();
                this.updatePercent();
                this.dateTime = new Date();
            }
        };
        Indicator.prototype.updateCounts = function () {
            var _this = this;
            this.counts.upCount = this.grouped["HEALTHY"].count;
            this.counts.allCount = this.allServices.length;
            this.counts.downCount = this.grouped["UNHEALTHY"].count;
            this.counts.warningCount = this.grouped["WARNING"].count;
            this.counts.errorCount = this.counts.downCount + this.counts.warningCount;
            angular.forEach(this.chartData, function (item, i) {
                item.value = _this.grouped[item.key].count;
            });
            this.chartOptions.chart.title = this.counts.allCount + " " + this.$filter('translate')('Total');
        };
        Indicator.prototype.updatePercent = function () {
            if (this.counts.upCount > 0) {
                this.percent = (this.counts.upCount / this.counts.allCount) * 100;
                this.percent = Math.round(this.percent);
            }
            if (this.percent <= 50) {
                this.healthClass = "errors";
            }
            else if (this.percent < 100) {
                this.healthClass = "warnings";
            }
            else {
                this.healthClass = "success";
            }
        };
        return Indicator;
    }());
    var controller = /** @class */ (function () {
        function controller($scope, $element, $http, $mdDialog, $mdPanel, $interval, $timeout, ServicesStatusData, OpsManagerDashboardService, BroadcastService, $filter) {
            var _this = this;
            this.$scope = $scope;
            this.$element = $element;
            this.$http = $http;
            this.$mdDialog = $mdDialog;
            this.$mdPanel = $mdPanel;
            this.$interval = $interval;
            this.$timeout = $timeout;
            this.ServicesStatusData = ServicesStatusData;
            this.OpsManagerDashboardService = OpsManagerDashboardService;
            this.BroadcastService = BroadcastService;
            this.$filter = $filter;
            this.dataLoaded = false;
            this.chartApi = {};
            this.chartOptions = {
                chart: {
                    type: 'pieChart',
                    x: function (d) {
                        return d.key;
                    },
                    y: function (d) {
                        return d.value;
                    },
                    showLabels: false,
                    duration: 100,
                    "height": 150,
                    labelThreshold: 0.01,
                    labelSunbeamLayout: false,
                    "margin": { "top": 10, "right": 10, "bottom": 10, "left": 10 },
                    donut: true,
                    donutRatio: 0.65,
                    showLegend: false,
                    valueFormat: function (d) {
                        return parseInt(d);
                    },
                    color: function (d) {
                        if (d.key == 'HEALTHY') {
                            return '#009933';
                        }
                        else if (d.key == 'UNHEALTHY') {
                            return '#FF0000';
                        }
                        else if (d.key == 'WARNING') {
                            return '#FF9901';
                        }
                    },
                    pie: {
                        dispatch: {
                            'elementClick': function (e) {
                                _this.openDetailsDialog(e.data.key);
                            }
                        }
                    },
                    dispatch: {
                        renderEnd: function () {
                        }
                    }
                }
            };
            this.validateTitle();
            this.indicator = new Indicator(this.chartOptions, this.$filter);
        } // end of constructor
        controller.prototype.watchDashboard = function () {
            var _this = this;
            this.BroadcastService.subscribe(this.$scope, this.OpsManagerDashboardService.DASHBOARD_UPDATED, function (dashboard) {
                _this.ServicesStatusData.transformServicesResponse(_this.OpsManagerDashboardService.dashboard.serviceStatus);
                var services = _this.ServicesStatusData.services;
                var servicesArr = [];
                for (var k in services) {
                    servicesArr.push(services[k]);
                }
                _this.indicator.addServices(servicesArr);
                _this.dataLoaded = true;
            });
        };
        controller.prototype.openDetailsDialog = function (key) {
            this.$mdDialog.show({
                controller: "ServicesDetailsDialogController",
                templateUrl: 'js/ops-mgr/overview/services-indicator/services-details-dialog.html',
                parent: angular.element(document.body),
                clickOutsideToClose: true,
                fullscreen: true,
                locals: {
                    status: key,
                    selectedStatusData: this.indicator.grouped[key]
                }
            });
        };
        controller.prototype.updateChart = function () {
            var title = (this.indicator.counts.allCount) + " " + this.$filter('translate')('Total');
            this.chartOptions.chart.title = title;
            if (this.chartApi.update) {
                this.chartApi.update();
            }
        };
        controller.prototype.validateTitle = function () {
            var _this = this;
            if (this.validateTitleTimeout != null) {
                this.$timeout.cancel(this.validateTitleTimeout);
            }
            var txt = this.$element.find('.nv-pie-title').text();
            if ($.trim(txt) == "0 Total" && this.indicator.counts.allCount > 0) {
                this.updateChart();
            }
            this.validateTitleTimeout = this.$timeout(function () {
                _this.validateTitle();
            }, 1000);
        };
        controller.prototype.$onInit = function () {
            this.ngOnInit();
        };
        controller.prototype.ngOnInit = function () {
            this.watchDashboard();
        };
        controller.$inject = ["$scope", "$element", "$http",
            "$mdDialog", "$mdPanel", "$interval", "$timeout",
            "ServicesStatusData", "OpsManagerDashboardService",
            "BroadcastService", '$filter'];
        return controller;
    }());
    exports.default = controller;
    var servicesDetailsDialogController = /** @class */ (function () {
        function servicesDetailsDialogController($scope, $mdDialog, $interval, StateService, status, selectedStatusData) {
            this.$scope = $scope;
            this.$mdDialog = $mdDialog;
            this.$interval = $interval;
            this.StateService = StateService;
            this.status = status;
            this.selectedStatusData = selectedStatusData;
            $scope.css = status == "UNHEALTHY" ? "md-warn" : "";
            $scope.status = status;
            $scope.services = selectedStatusData.data;
            _.each($scope.services, function (service) {
                service.componentMessage = null;
                if (service.components.length == 1) {
                    service.componentName = service.components[0].name;
                    service.componentMessage = service.components[0].message;
                }
            });
            $scope.hide = function () {
                $mdDialog.hide();
            };
            $scope.gotoServiceDetails = function (serviceName) {
                $mdDialog.hide();
                StateService.OpsManager().ServiceStatus().navigateToServiceDetails(serviceName);
            };
            $scope.cancel = function () {
                $mdDialog.cancel();
            };
        }
        return servicesDetailsDialogController;
    }());
    exports.servicesDetailsDialogController = servicesDetailsDialogController;
    angular.module(module_name_1.moduleName).controller('ServicesDetailsDialogController', ["$scope", "$mdDialog", "$interval", "StateService", "status",
        "selectedStatusData", servicesDetailsDialogController]);
    angular.module(module_name_1.moduleName).controller('ServicesIndicatorController', controller);
    angular.module(module_name_1.moduleName)
        .directive('tbaServicesIndicator', [function () {
            return {
                restrict: "EA",
                scope: {},
                bindToController: {
                    panelTitle: "@"
                },
                controllerAs: 'vm',
                templateUrl: 'js/ops-mgr/overview/services-indicator/services-indicator-template.html',
                controller: "ServicesIndicatorController",
                link: function ($scope, element, attrs) {
                    $scope.$on('$destroy', function () {
                    });
                } //DOM manipulation\}
            };
        }]);
});
//# sourceMappingURL=ServicesIndicatorDirective.js.map