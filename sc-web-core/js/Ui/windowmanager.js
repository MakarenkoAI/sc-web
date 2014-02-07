SCWeb.ui.WindowManager = {
    
    // dictionary that contains information about windows corresponding to history items
    windows: {},
    window_count: 0,
    window_active_formats: {},
    sandboxes: {},
    active_window_addr: null,
    active_history_addr: null,
    
    
    // function to create hash from question addr and format addr
    hash_addr: function(question_addr, fmt_addr) {
        return question_addr + ':' + fmt_addr;
    },
    
    init: function(params) {
        var dfd = new jQuery.Deferred();
        this.ext_langs = params.external_languages;
        
        this.history_tabs_id = '#history-items';
        this.history_tabs = $(this.history_tabs_id);
        
        this.window_container_id = '#window-container';
        this.window_container = $(this.window_container_id);
        
        var self = this;
        
        // external language
        var ext_langs_items = '';
        for (idx in this.ext_langs) {
            var addr = this.ext_langs[idx];
            ext_langs_items += '<li><a href="#" sc_addr="' + addr + '">' + addr + '</a></li>';
        }
        $('#history-item-langs').html(ext_langs_items).find('[sc_addr]').click(function(event) {
            var question_addr = self.active_history_addr;
            var lang_addr = $(this).attr('sc_addr');
            var fmt_addr = SCWeb.core.ComponentManager.getPrimaryFormatForExtLang(lang_addr);
            
            if (fmt_addr) {
                self.window_active_formats[question_addr] = fmt_addr;
                self.requestTranslation(question_addr, fmt_addr);
            } else {
                // TODO: process error
            }
            
        });
    
        $('#history-item-print').click(function (){
            // get ctive window data
            var data = self.window_container.find("[sc_addr='" + self.active_window_addr + "']").html();
            
            var html = '<html><head>' + $('head').html() + '</head></html><body>' + data + '</body>';
            var styles = '';

            var DOCTYPE = "<!DOCTYPE html>"; // your doctype declaration
            var printPreview = window.open('about:blank', 'print_preview');
            var printDocument = printPreview.document;
            printDocument.open();
            printDocument.write(DOCTYPE +
                    '<html>' +
                        '<head>' + styles + '</head>' +
                        '<body class="print-preview">' + html + '</body>' +
                    '</html>');
            printDocument.close();
        });
        
        // listen translation events
        SCWeb.core.EventManager.subscribe("translation/update", this, this.updateTranslation);
        SCWeb.core.EventManager.subscribe("translation/get", this, function(objects) {
            $(this.history_tabs_id + ' [sc_addr], #history-item-langs [sc_addr]').each(function(index, element) {
                objects.push($(element).attr('sc_addr'));
            });
        });
        
        dfd.resolve();
        return dfd.promise();
    },
    
    // ----------- History ------------
    /**
     * Append new tab into history
     * @param {String} question_addr sc-addr of item to append into history
     */
    appendHistoryItem: function(question_addr) {
        
        // @todo check if tab exist        
        var tab_html = '<a class="list-group-item history-item" sc_addr="' + question_addr + '">' +
                            '<h5 class="history-item-name list-group-item-heading">' + question_addr + '</h5>' +
                            '<p class="list-group-item-text"> description </p>' +
                        '</a>';

        this.history_tabs.prepend(tab_html);
                
        // get translation and create window
        var ext_lang_addr = SCWeb.core.Main.getDefaultExternalLang();
        var fmt_addr = SCWeb.core.ComponentManager.getPrimaryFormatForExtLang(ext_lang_addr);
        if (fmt_addr) {
            this.requestTranslation(question_addr, fmt_addr);
        } else
        {
            // error
        }
        
        this.setHistoryItemActive(question_addr);
        
        // setup input handlers
        var self = this;
        this.history_tabs.find("[sc_addr]").click(function(event) {
            var question_addr = $(this).attr('sc_addr');
            self.setHistoryItemActive(question_addr);
            self.setWindowActive(self.windows[self.hash_addr(question_addr, self.window_active_formats[question_addr])]);
            
        });
    },
    
    /**
     * Removes specified history item
     * @param {String} addr sc-addr of item to remove from history
     */
    removeHistoryItem: function(addr) {
        this.history_tabs.find("[sc_addr='" + addr + "']").remove();
    },
    
    /**
     * Set new active history item
     * @param {String} addr sc-addr of history item
     */
    setHistoryItemActive: function(addr) {
        if (this.active_history_addr) {
            this.history_tabs.find("[sc_addr='" + this.active_history_addr + "']").removeClass('active').find('.histoy-item-btn').addClass('hidden');
        }
        
        this.active_history_addr = addr;
        this.history_tabs.find("[sc_addr='" + this.active_history_addr + "']").addClass('active').find('.histoy-item-btn').removeClass('hidden');
    },
    
    /**
     * Get translation of question to external language and append new window for it
     * @param {String} question_addr sc-addr of question to translate
     * @param {String} fmt_addt sc-addr of output format
     */
    requestTranslation: function(question_addr, fmt_addr) {
        var self = this;
        var window = self.windows[self.hash_addr(question_addr, fmt_addr)];
        if (window) {
            self.setWindowActive(window);
        } else {
            
            SCWeb.ui.Locker.show();
            // scroll window to the top
            //$("html, body").animate({ scrollTop: 0}, "slow");
            SCWeb.core.Server.getAnswerTranslated(question_addr, fmt_addr, function(data) {
                self.appendWindow(data.link, fmt_addr);
                self.window_active_formats[question_addr] = fmt_addr;
                self.windows[self.hash_addr(question_addr, fmt_addr)] = data.link;
                SCWeb.ui.Locker.hide();
            });
        }
    },
    
    // ------------ Windows ------------
    /**
     * Append new window
     * @param {String} addr sc-addr of question
     * @param {String} fmt_addr sc-addr of window format
     */
    appendWindow: function(addr, fmt_addr) {
        
        var window_id = 'window_' + addr;
        var window_html =   '<div class="panel panel-default sc-window" sc_addr="' + addr + '" sc-addr-fmt="' + fmt_addr + '">' +
                                '<div class="panel-body" id="' + window_id + '"></div>'
                            '</div>';
        this.window_container.prepend(window_html);
        
        this.hideActiveWindow();
        var sandbox = SCWeb.core.ComponentManager.createWindowSandbox(fmt_addr, addr, window_id);
        if (sandbox) {
            this.sandboxes[addr] = sandbox;
            this.setWindowActive(addr);
        } else {
            this.showActiveWindow();
            throw "Error while create window";
        };
        
    },
    
    /**
     * Remove specified window
     * @param {String} addr sc-addr of window to remove
     */
    removeWindow: function(addr) {
        this.window_container.find("[sc_addr='" + addr + "']").remove();
    },
    
    /**
     * Makes window with specified addr active
     * @param {String} addr sc-addr of window to make active
     */
    setWindowActive: function(addr) {
        this.hideActiveWindow();
        
        this.active_window_addr = addr;
        this.showActiveWindow();
    },

    hideActiveWindow: function() {
        if (this.active_window_addr) {
            this.window_container.find("[sc_addr='" + this.active_window_addr + "']").addClass('hidden');
        }
    },

    showActiveWindow: function() {
        if (this.active_window_addr) {
            this.window_container.find("[sc_addr='" + this.active_window_addr + "']").removeClass('hidden'); 
        }
    },

    /*!
     * Genarate html for new window container
     * @param {String} containerId ID that will be set to container
     * @param {String} classes Classes that will be added to container
     * @param {String} addr sc-addr of window
     */
    generateWindowContainer: function(containerId, classes, addr) {

        return '<div class="sc-content-wrap" id="' + containerId + '_wrap"> \
                    <div class="sc-content-controls"> </div> \
                    <div id="' + containerId + '" class="sc-content ' + classes + '" sc_addr="' + addr + '"> </div> \
                </div>';
    },

    /**
     * Create viewers for specified sc-links
     * @param {Object} containers_map Map of viewer containers (key: sc-link addr, value: id of container)
     */
    createViewersForScLinks: function(containers_map) {
        var dfd = new jQuery.Deferred();

        var linkAddrs = [];
        for (var cntId in containers_map)
                linkAddrs.push(containers_map[cntId]);

        if (linkAddrs.length == 0) {
            dfd.resolve();
            return dfd.promise();
        }
                    
        SCWeb.core.Server.getLinksFormat(linkAddrs,
            function(formats) {
                
                var result = {};

                for (var cntId in containers_map) {
                    var addr = containers_map[cntId];
                    var fmt = formats[addr];
                    if (fmt) {
                        var sandbox = SCWeb.core.ComponentManager.createWindowSandbox(fmt, addr, cntId);
                        if (sandbox) {
                            result[addr] = sandbox;
                        }
                    }
                }
                
                dfd.resolve();
            },
            function() {
                dfd.reject();
            }
        );
        
        return dfd.promise();
    },

    // ---------- Translation listener interface ------------
    updateTranslation: function(namesMap) {
        // apply translation
        $(this.history_tabs_id + '[sc_addr] , #history-item-langs [sc_addr]').each(function(index, element) {
            var addr = $(element).attr('sc_addr');
            if(namesMap[addr]) {
                $(element).text(namesMap[addr]);
            }
        });
        
    },
};
