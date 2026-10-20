export function formatDate(value:unknown,locale:string):string {
 if(typeof value!=='string'||!value.trim())return '—';
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat(locale==='fr'?'fr-CA':'en-CA',{dateStyle:'medium',timeZone:'America/Toronto'}).format(date);
}
