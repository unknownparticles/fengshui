import { describe, expect, it } from 'vitest';
import { boundary, circularMean, convertNorth, coveringArc, interval, mountain, MOUNTAINS, normalize, opposite, parseAngle, sampleQuality, type Sample } from './direction';

describe('地盘方向契约', () => {
  it('验证全部山的中心、宫位、对山和每条半开山界', () => {
    const reference = [
      ['子','坎','午'],['癸','坎','丁'],['丑','艮','未'],['艮','艮','坤'],['寅','艮','申'],['甲','震','庚'],
      ['卯','震','酉'],['乙','震','辛'],['辰','巽','戌'],['巽','巽','乾'],['巳','巽','亥'],['丙','离','壬'],
      ['午','离','子'],['丁','离','癸'],['未','坤','丑'],['坤','坤','艮'],['申','坤','寅'],['庚','兑','甲'],
      ['酉','兑','卯'],['辛','兑','乙'],['戌','乾','辰'],['乾','乾','巽'],['亥','乾','巳'],['壬','坎','丙'],
    ];
    reference.forEach(([name,palace,back], i) => {
      expect(mountain(i*15)).toMatchObject({name,palace,opposite:back});
      expect(mountain(opposite(i*15)).name).toBe(back);
      expect(mountain(i*15+7.49).name).toBe(name);
      expect(mountain(i*15+7.5).name).toBe(reference[(i+1)%24][0]);
      expect(mountain(i*15+7.51).name).toBe(reference[(i+1)%24][0]);
    });
    expect(new Set(MOUNTAINS.map(m=>m.name)).size).toBe(24);
  });
  it.each([[0,'子'],[360,'子'],[1,'子'],[7.49,'子'],[7.5,'癸'],[22.5,'丑'],[90,'卯'],[135,'巽'],[180,'午'],[225,'坤'],[270,'酉'],[315,'乾'],[337.5,'壬'],[352.49,'壬'],[352.5,'子'],[359,'子']])('向 %s 度属于 %s', (angle,name) => expect(mountain(Number(angle)).name).toBe(name));
  it('拒绝非法手录，内部归一化允许负数', () => {
    for(const input of ['',' ','-1','361','NaN','Infinity']) expect(()=>parseAngle(input)).toThrow();
    expect(parseAngle('360')).toBe(0); expect(normalize(-1)).toBe(359);
    expect(interval(0)).toContain('352.5'); expect(boundary(7.49)).toMatchObject({left:'子',right:'癸'});
  });
  it('参考北从原始角度换算且必须有完整来源', () => {
    const correction = {degrees:12,source:'实体测量',date:'2026-10-04',place:'现场'};
    expect(convertNorth(350,'magnetic','true',correction)).toBe(2);
    expect(convertNorth(2,'true','magnetic',correction)).toBe(350);
    expect(convertNorth(2,'magnetic','true',{...correction,degrees:-12})).toBe(350);
    expect(()=>convertNorth(1,'unknown','magnetic',correction)).toThrow();
    expect(()=>convertNorth(1,'true','magnetic',{...correction,source:''})).toThrow();
  });
  it('跨零均值、相反方向及最短覆盖弧', () => {
    expect(circularMean([359,0,1]).angle).toBeCloseTo(0);
    expect(coveringArc([359,0,1])).toBe(2); expect(coveringArc([170,180,190])).toBe(20);
    expect(circularMean([0,180]).angle).toBeNull();
  });
});
describe('采样质量门槛', () => {
  const samples: Sample[] = Array.from({length:12},(_,i)=>({angle:i%2?359:1,at:1000+i*250,beta:0,gamma:0,north:'magnetic',portrait:true,accuracy:null,source:'验证样本'}));
  it('合格样本跨北均值，精度字段仍未知', () => { const q=sampleQuality(samples,4000,1000); expect(q.stable).toBe(true);expect(q.accuracy).toBeNull();expect(q.angle).toBeCloseTo(0); });
  it.each(['north','pose','low','count','stale','unstable'])('阻止 %s 样本正式锁定', reason => {
    let list=structuredClone(samples); let now=4000;
    if(reason==='north') list=list.map(s=>({...s,north:'unknown'}));
    if(reason==='pose') list[11].beta=16;
    if(reason==='low') list[11].accuracy=10;
    if(reason==='count') list=list.slice(-9);
    if(reason==='stale') now=6000;
    if(reason==='unstable') list=list.map((s,i)=>({...s,angle:i%2?0:180}));
    expect(sampleQuality(list,now,1000).stable).toBe(false);
  });
});
