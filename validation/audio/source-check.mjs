// Confirm that the source itself never meets the waveform silence definition.
let minPeak=1,quiet=0;
for(let frame=0;frame<12000*12;frame+=60){
 let peak=0;
 for(let i=0;i<60;i++){
  const t=(frame+i)/12000;
  const value=Math.round(1200*Math.sin(2*Math.PI*220*t)*Math.exp(-12*(t%.5)))/32768;
  peak=Math.max(Math.abs(value),peak);
 }
 minPeak=Math.min(peak,minPeak);if(peak<.000008)quiet++;
}
console.log({minimumFiveMsPeak:minPeak,quietWindows:quiet,totalWindows:2400});
