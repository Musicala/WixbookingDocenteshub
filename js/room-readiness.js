export function roomReadinessAlerts(events,now=Date.now()){
 const time=value=>new Date(value).getTime();
 const active=events.filter(e=>!['cancelled','canceled','cancelada'].includes(String(e.extendedProps?.statusKey||e.extendedProps?.status||'').toLowerCase())&&time(e.end)>now);
 const alerts=[];
 for(const event of active){
  if(time(event.start)>now+60*60000)continue;
  const assignment=event.extendedProps?.roomAssignment;
  const key=event.extendedProps?.groupKey||event.id;
  if(!assignment?.roomName){alerts.push({event,key,kind:'missing-room',message:time(event.start)<=now?'La clase está en curso y todavía no tiene salón.':`Empieza en ${Math.max(1,Math.ceil((time(event.start)-now)/60000))} min y todavía no tiene salón.`});continue;}
  if(assignment.roomIndex==null||Number(assignment.roomIndex)===10)continue;
  const overlap=active.some(other=>other!==event&&(other.extendedProps?.groupKey||other.id)!==key&&other.extendedProps?.roomAssignment?.roomIndex!=null&&Number(other.extendedProps.roomAssignment.roomIndex)===Number(assignment.roomIndex)&&time(other.start)<time(event.end)&&time(other.end)>time(event.start));
  if(overlap)alerts.push({event,key,kind:'room-overlap',message:'Hay un cruce de salón pendiente de revisar antes de la clase.'});
 }
 return alerts;
}
