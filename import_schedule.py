"""将河南大学同格式的本学期开封教室课表转换为 App 数据。"""
import argparse, json, re
from pathlib import Path
import xlrd

CAMPUSES={'明伦校区','金明校区'}
TIMES={
 '1':['08:00','08:45'],'2':['08:55','09:40'],'3':['10:00','10:45'],
 '4':['10:55','11:40'],'5':['11:45','12:30'],'6':['14:05','14:50'],
 '7':['15:00','15:45'],'8':['15:55','16:40'],'9':['17:00','17:45'],
 '10':['17:55','18:40'],'11':['19:10','19:55'],'12':['20:05','20:50'],
 '13':['20:55','21:40'],'noon':['12:30','14:00']
}

def weeks_from(text,parity):
    weeks=set()
    for item in text.replace('，',',').split(','):
        values=[int(n) for n in item.split('-')]
        if len(values)==1:weeks.add(values[0])
        elif len(values)==2 and values[0]<=values[1]:weeks.update(range(values[0],values[1]+1))
        else:raise ValueError('无法识别周次：'+text)
    if parity:weeks={w for w in weeks if w%2==(1 if parity=='单' else 0)}
    if not weeks or min(weeks)<1 or max(weeks)>30:raise ValueError('周次超出支持范围：'+text)
    return sorted(weeks)

def read_workbook(path):
    workbook=xlrd.open_workbook(str(path))
    rooms=[];errors=[];current=None;exported_at=None
    for sheet in workbook.sheets():
        for row_idx in range(sheet.nrows):
            row=sheet.row_values(row_idx)
            if len(row)<9:continue
            header=str(row[0])
            if header.startswith('河南大学'):
                if '2026-2027学年第一学期' not in header:
                    raise ValueError('目前的日期配置只适用于2026-2027学年第一学期。请先更新学期配置。')
                match=re.search(r'\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}',header)
                if match:exported_at=match.group(0)
                current=None
                continue
            if header.startswith('校区：'):
                campus=header.split('：',1)[1]
                if campus not in CAMPUSES:current=None;continue
                raw_name=str(row[6]).split('：',1)[1]
                cap=re.search(r'[（(](\d+)[)）]$',raw_name)
                name=raw_name[:cap.start()] if cap else raw_name
                number=re.search(r'(\d{3,4})(?=\D*$)',name)
                if not number:raise ValueError(f'第{row_idx+1}行的楼层编号需要人工确认：{name}')
                code=number.group(1);floor=int(code[-3])
                if floor<1 or floor>10:raise ValueError('楼层编号需要人工确认：'+name)
                current={'id':campus+'/'+name,'campus':campus,'building':str(row[2]).split('：',1)[1],
                    'name':name,'code':code,'floor':floor,'floorSource':'按教室编号推算',
                    'capacity':int(cap.group(1)) if cap else None,'type':str(row[4]).split('：',1)[1],
                    'sourceRow':row_idx+1,'events':[]}
                rooms.append(current)
                continue
            if not current:continue
            for column in range(2,9):
                cell=str(row[column]).strip()
                if not cell or cell.startswith('星期'):continue
                for line in cell.splitlines():
                    if not line.strip():continue
                    match=re.search(r'\[([^\]]+)\]周\s*(?:([单双])周\s*)?(中午)?(\d+)(?:-(\d+))?节',line)
                    if not match:errors.append(f'第{row_idx+1}行、第{column+1}列有未识别的课程。');continue
                    week_text,parity,noon,start,end=match.groups()
                    start,end=int(start),int(end or start)
                    if start<1 or start>end or end>(2 if noon else 13):
                        errors.append(f'第{row_idx+1}行节次需要确认。');continue
                    current['events'].append({'day':column-1,'weeks':weeks_from(week_text,parity),
                        'weekText':week_text+(' '+parity+'周' if parity else ''),'start':start,'end':end,
                        'session':'noon' if noon else 'regular','sourceRow':row_idx+1,'sourceColumn':column+1})
    if errors:raise ValueError('\n'.join(errors[:20])+f'\n共{len(errors)}处需要确认，未覆盖旧数据。')
    if not rooms or len({r['id'] for r in rooms})!=len(rooms):raise ValueError('没有有效教室，或发现重复教室。')
    if {r['campus'] for r in rooms}!=CAMPUSES:raise ValueError('请提供同时包含明伦、金明校区的完整课表。')
    if not exported_at:raise ValueError('未找到课表导出日期，未覆盖旧数据。')
    events=[e for r in rooms for e in r['events']]
    return {'schemaVersion':1,'school':'河南大学','semester':'2026-2027学年第一学期',
        'sourceName':path.name,'sourceExportedAt':exported_at,
        'anchor':{'date':'2026-10-03','week':5,'weekday':6,'firstMonday':'2026-08-31'},
        'maxWeek':max(w for e in events for w in e['weeks']),
        'timeSource':'用户提供的开封校区统一作息表','knownTimes':TIMES,
        'counts':{'rooms':len(rooms),'events':len(events),'parityEvents':sum('单周' in e['weekText'] or '双周' in e['weekText'] for e in events),'noonEvents':sum(e['session']=='noon' for e in events)},
        'rooms':rooms,'timesConfirmed':True}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file',type=Path)
    parser.add_argument('--out',type=Path,default=Path(__file__).parent/'dist'/'data.js')
    args=parser.parse_args()
    data=read_workbook(args.file)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    temporary=args.out.with_suffix(args.out.suffix+'.tmp')
    temporary.write_text('window.CLASSROOM_DATA='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    temporary.replace(args.out)
    print(f'已导入{data["counts"]["rooms"]}间教室、{data["counts"]["events"]}条课程安排。')
