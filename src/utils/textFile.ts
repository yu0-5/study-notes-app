const MAX_TEXT_FILE_BYTES = 1024 * 1024;
export function validateTextFile(file: File): string {
    const fileName = file.name.toLowerCase();
    if(!fileName.endsWith('.txt') && !fileName.endsWith('.md')){
        return'不支持的文件类型,请选择txt或md文件';
    }
    if(file.size > MAX_TEXT_FILE_BYTES){
        return '文件过大,请选择小于1MB的文件';
    }
    if(file.size === 0){
        return '文件为空,请选择包含正文的文件';
    }
    return''; 
}
  
