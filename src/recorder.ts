import {WordflowSettings} from "./main";
import WordflowTrackerPlugin from "./main";
import { DocTracker } from './DocTracker';
import { Setting, TFile } from 'obsidian';
import moment from 'moment';

// Configuration Constants
const START_POSITION = "title: 当天编辑的文件\ncollapse: close";
const END_POSITION = "````";

export function recorder(){
    // something
    return async function(plugin:WordflowTrackerPlugin){
        //xxxxx
        let recordNoteName = moment().format(plugin.settings.periodicNoteFormat);
        let recordNotePath = plugin.settings.periodicNoteFolder + recordNoteName + '.md';
        let recordNote = plugin.app.vault.getFileByPath(recordNotePath)
        if (!recordNote) {
            console.log("Could not find note with path:", recordNotePath)
            return;
        }
        else {
            await plugin.app.vault.process(recordNote, (data) => {
            return data.concat(getRecordData(plugin.settings, plugin.trackerMap));
            //return data.replace('Hello', getRecordData(plugin.settings, plugin.trackerMap));
        })}
        
    }
}

function sortReflector(tracker: DocTracker, sortBy: string):any {
    switch (sortBy){
        case 'lastModifiedTime': return tracker.lastModifiedTime;
        case 'editedWords': return tracker.changedWords;
        case 'editedTimes': return tracker.changedTimes;
        case 'editedPercentage': return (100 * tracker.changedWords / tracker.docLength).toFixed(0).toString() + `%`; // warning: this is not stable.
        case 'modifiedNote': return tracker.filePath;
        default: throw Error("Cannot recognize sortBy string!");
    }
}

function varMap(varName:string, tracker:DocTracker, settings:WordflowSettings):any {
    switch (varName){
        case 'lastModifiedTime': return moment(tracker.lastModifiedTime).format(settings.timeFormat);
        case 'editedWords': return tracker.changedWords;
        case 'editedTimes': return tracker.changedTimes;
        case 'editedPercentage': return (100 * tracker.changedWords / tracker.docLength).toFixed(0).toString() + `%`; // warning: this is not stable.
        case 'modifiedNote': return tracker.filePath;
        default: throw Error("Cannot recognize var expression!");
    }
}

function getRecordData(settings:WordflowSettings, trackerMap:Map<string, DocTracker>): string {
    let outPutContent = '';
    
    if (settings.recordType === 'bullet list') {
        // bullet list处理逻辑
        trackerMap.forEach((docTracker) => {
            const replacedContent = settings.bulletListSyntax
                .replace(/\${modifiedNote}/g, docTracker.filePath)
                .replace(/\${lastModifiedTime}/g, moment(docTracker.lastModifiedTime).format(settings.timeFormat))
                .replace(/\${editedWords}/g, docTracker.changedWords.toString()) 
                .replace(/\${editedTimes}/g, docTracker.changedTimes.toString()) 
                .replace(/\${editedWords}/g, (100 * docTracker.changedWords / docTracker.docLength).toFixed(0)) // warning: this is not stable.)
                + '\n';
            outPutContent += replacedContent;
        });
    } else if (settings.recordType === 'table') {
        const [header, separator, ...templateRows] = settings.tableSyntax.split('\n').filter(l => l.trim());
        
        // 排序处理
        const sorted = Array.from(trackerMap.values()).sort((a, b) => {
            const aVal = sortReflector(a, settings.sortBy);
            const bVal = sortReflector(b, settings.sortBy);
            
            // 数值型排序
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return settings.isDescend ? bVal - aVal : aVal - bVal;
            }
            
            // 时间戳排序（当sortBy是lastModifiedTime时）
            if (settings.sortBy === 'lastModifiedTime') {
                return settings.isDescend ? bVal - aVal : aVal - bVal;
            }

            // 默认字符串排序
            return settings.isDescend 
                ? String(bVal).localeCompare(String(aVal)) 
                : String(aVal).localeCompare(String(bVal));
        });

        // 生成表格内容
        const rows = sorted.map(tracker => {
            return templateRows
                .map(line => line.replace(
                    /\${(\w+)}/g, 
                    (_, varName: string) => {
                        const value = varMap(varName, tracker, settings);
 
                        return String(value ?? '');
                    }
                ))
                .join('\n');
        });

        // 组装完整表格
        outPutContent = [
            header,
            separator,
            ...rows.flatMap(r => r.split('\n'))
        ].join('\n');
    }
    
    return outPutContent.trim();
}