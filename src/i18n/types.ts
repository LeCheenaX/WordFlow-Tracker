export interface MultiLineContent {
    segments: string[];
    links?: Array<{
        id: string;  // Link identifier to be used in segment text as {linkId}
        text: string;
        href: string;
    }>;
    params?: Record<string, any>;
}

// Type for description that can be string, array, or complex object
export type DescriptionType = string | string[] | MultiLineContent;

export interface LocaleResources {
    language: string;
    settings: SettingsResources;
    commands: CommandsResources;
    notices: NoticesResources;
    widget: WidgetResources;
    modals: ModalsResources;
    changelog: ChangelogResources;
}

export interface SettingsResources {
    tabs: {
        general: string;
        recorders: string;
        timers: string;
        widget: string;
        statusBar: string;
    };
    general: GeneralSettingsResources;
    recorders: RecordersSettingsResources;
    timers: TimersSettingsResources;
    widget: WidgetSettingsResources;
    statusBar: StatusBarSettingsResources;
}

export interface GeneralSettingsResources {
    showRecordRibbonIcon: {
        name: string;
        desc: string;
    };
    ignoredFolders: {
        name: string;
        desc: DescriptionType;
        placeholder: string;
        validation: {
            valid: string;
            invalid: string;
        };
    };
    ignoredTags: {
        name: string;
        desc: DescriptionType;
        placeholder: string;
    };
    noteThreshold: {
        name: string;
        desc: DescriptionType;
        options: {
            e: string;
            t: string;
            ent: string;
            eot: string;
            n: string;
        };
    };
    noteToRecord: {
        name: string;
        desc: DescriptionType;
        options: {
            all: string;
            crt: string;
        };
    };
    autoRecordInterval: {
        name: string;
        desc: DescriptionType;
        placeholder: string;
    };
    resetSettings: {
        name: string;
        desc: string;
        button: string;
    };
    language: {
        name: string;
        desc: string;
    };
}

export interface RecordersSettingsResources {
    currentRecorder: {
        name: string;
        desc: DescriptionType;
    };
    actions: {
        delete: string;
        rename: string;
        add: string;
    };
    confirmations: {
        addRecorder: string;
        deleteRecorder: string;
    };
    periodicNote: {
        heading: string;
        folder: {
            name: string;
            desc: DescriptionType;
            dynamicEnabled: string;
            dynamicDisabled: string;
            placeholderDynamic: string;
            placeholderStatic: string;
            confirmToggle: string;
        };
        format: {
            name: string;
            desc: DescriptionType;
            preview: string;
        };
    };
    templatePlugin: {
        name: string;
        desc: DescriptionType;
        options: {
            none: string;
            templates: string;
        };
        validation: {
            templaterEnabled: string;
        };
        filePath: {
            name: string;
            desc: DescriptionType;
            placeholder: string;
            validation: {
                found: string;
                notFound: string;
            };
        };
        dateFormat: {
            name: string;
            desc: string;
            preview: string;
        };
        timeFormat: {
            name: string;
            desc: string;
            preview: string;
        };
    };
    recordingContents: {
        heading: string;
        recordType: {
            name: string;
            desc: string;
            options: {
                table: string;
                bulletList: string;
                metadata: string;
            };
        };
        syntax: {
            name: string;
            desc: DescriptionType;
        };
        insertPlace: {
            name: string;
            desc: DescriptionType;
            options: {
                bottom: string;
                custom: string;
                yaml: string;
            };
            startPosition: {
                name: string;
                desc: string;
            };
            endPosition: {
                name: string;
                desc: string;
            };
        };
        sortBy: {
            name: string;
            desc: string;
            options: {
                lastModifiedTime: string;
                editedWords: string;
                editedTimes: string;
                editedPercentage: string;
                modifiedNote: string;
                editTime: string;
            };
            order: {
                descend: string;
                ascend: string;
            };
        };
        timeFormat: {
            name: string;
            desc: string;
            preview: string;
        };
    };
}

export interface TimersSettingsResources {
    idleInterval: {
        name: string;
        desc: DescriptionType;
        placeholder: string;
    };
    useSecondInWidget: {
        name: string;
        desc: DescriptionType;
    };
}

export interface WidgetSettingsResources {
    enableOnLoad: {
        name: string;
        desc: string;
    };
    showRibbonIcon: {
        name: string;
        desc: string;
    };
    switchToFieldOnFocus: {
        name: string;
        desc: DescriptionType;
        options: {
            disabled: string;
            readTime: string;
            readEditTime: string;
        };
        validation: {
            hasField: string;
        };
    };
    colorGroupLightness: {
        name: string;
        desc: string;
        placeholder: string;
    };
    colorGroupSaturation: {
        name: string;
        desc: DescriptionType;
        preview: string;
    };
    fieldAlias: {
        name: string;
        desc: string;
        addButton: string;
        deleteButton: string;
        placeholder: string;
        noOptions: string;
    };
}

export interface StatusBarSettingsResources {
    enableMobile: {
        name: string;
        desc: DescriptionType;
    };
    customContent: {
        name: string;
        desc: DescriptionType;
        readingMode: {
            name: string;
            desc: DescriptionType;
        };
        editMode: {
            name: string;
            desc: DescriptionType;
        };
    };
}

export interface CommandsResources {
    recordWordflows: {
        name: string;
    };
    revealWidget: {
        name: string;
    };
}

export interface NoticesResources {
    recordSuccess: string;
    settingsReset: string;
    settingsResetFailed: string;
    recordTypeUndefined: string;
    focusPaused: string;
    languageChanged: string;
}

export interface WidgetResources {
    title: string;
    tooltips: {
        switchRecorder: string;
        switchField: string;
    };
    buttons: {
        record: string;
        focus: string;
        pause: string;
        quit: string;
    };
}

export interface ModalsResources {
    confirmation: {
        title: string;
        confirm: string;
        cancel: string;
    };
    renameRecorder: {
        title: string;
        save: string;
        cancel: string;
    };
}

export interface ChangelogResources {
    title: string;
    reference: string;
}
