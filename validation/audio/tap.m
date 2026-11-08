// Read just the isolated Chrome audio-service process at the macOS output mixer.
#import <Foundation/Foundation.h>
#import <CoreAudio/CoreAudio.h>
#import <CoreAudio/CATapDescription.h>
#import <CoreAudio/AudioHardwareTapping.h>
#import <mach/mach_time.h>
#include <signal.h>
#include <math.h>
#include <unistd.h>
static volatile sig_atomic_t quit;
static void stop(int sig){quit=1;}
static void check(OSStatus err,const char *op){if(err){fprintf(stderr,"%s: %d\n",op,(int)err);exit(2);}}
int main(int argc,char **argv){@autoreleasepool{
 if(argc!=3)return 1;
 pid_t pid=atoi(argv[1]);AudioObjectID process=0,tap=0,device=0;
 AudioObjectPropertyAddress addr={kAudioHardwarePropertyTranslatePIDToProcessObject,kAudioObjectPropertyScopeGlobal,0};
 UInt32 size=sizeof(process);check(AudioObjectGetPropertyData(1,&addr,sizeof(pid),&pid,&size,&process),"process lookup");
 if(!process){fprintf(stderr,"No matching audio process\n");return 2;}
 CATapDescription *desc=[[CATapDescription alloc] initMonoMixdownOfProcesses:@[@(process)]];
 desc.privateTap=YES;desc.name=@"EDM desktop output verification";desc.muteBehavior=CATapUnmuted;
 check(AudioHardwareCreateProcessTap(desc,&tap),"create process tap");
 addr.mSelector=kAudioTapPropertyFormat;AudioStreamBasicDescription fmt;size=sizeof(fmt);
 check(AudioObjectGetPropertyData(tap,&addr,0,NULL,&size,&fmt),"format");
 if(fmt.mFormatID!=kAudioFormatLinearPCM||!(fmt.mFormatFlags & kAudioFormatFlagIsFloat)||fmt.mBitsPerChannel!=32||fmt.mChannelsPerFrame!=1){fprintf(stderr,"unsupported format\n");return 2;}
 NSDictionary *config=@{@kAudioAggregateDeviceNameKey:@"Private EDM measurement",@kAudioAggregateDeviceUIDKey:[NSUUID UUID].UUIDString,@kAudioAggregateDeviceIsPrivateKey:@YES,@kAudioAggregateDeviceTapAutoStartKey:@YES,@kAudioAggregateDeviceTapListKey:@[@{@kAudioSubTapUIDKey:desc.UUID.UUIDString}]};
 check(AudioHardwareCreateAggregateDevice((__bridge CFDictionaryRef)config,&device),"create capture device");
 FILE *pcm=fopen(argv[2],"wb");if(!pcm)return 2;
 mach_timebase_info_data_t tb;mach_timebase_info(&tb);
 double scale=tb.numer/(double)tb.denom/1e6;
 double wallOffset=NSDate.date.timeIntervalSince1970*1000-mach_absolute_time()*scale;
 AudioDeviceIOProcID proc;__block long long samples=0;__block double expected=0;
 check(AudioDeviceCreateIOProcIDWithBlock(&proc,device,dispatch_queue_create("edm.capture",NULL),^(const AudioTimeStamp *now,const AudioBufferList *input,const AudioTimeStamp *stamp,AudioBufferList *out,const AudioTimeStamp *output){
  if(!input||!input->mNumberBuffers||!input->mBuffers[0].mData)return;
  const AudioBuffer b=input->mBuffers[0];unsigned n=b.mDataByteSize/sizeof(float);
  double time=stamp->mHostTime*scale+wallOffset;
  if(!samples||fabs(time-expected)>2){fprintf(stdout,"%lld %.3f %.3f\n",samples,time,samples?time-expected:0);fflush(stdout);}
  fwrite(b.mData,sizeof(float),n,pcm);samples+=n;expected=time+1000*n/fmt.mSampleRate;
 }),"create recording callback");
 fprintf(stderr,"capture rate %.0f\n",fmt.mSampleRate);fflush(stderr);
 signal(SIGTERM,stop);signal(SIGINT,stop);
 check(AudioDeviceStart(device,proc),"start process audio capture");
 while(!quit)usleep(100000);
 AudioDeviceStop(device,proc);AudioDeviceDestroyIOProcID(device,proc);AudioHardwareDestroyAggregateDevice(device);AudioHardwareDestroyProcessTap(tap);fclose(pcm);
 return 0;
}}
