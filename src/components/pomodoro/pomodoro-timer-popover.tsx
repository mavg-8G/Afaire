
"use client";

import React, { useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Timer, Play, Pause, RotateCcw, Coffee, Briefcase } from 'lucide-react';
import { useAppStore } from '@/hooks/use-app-store';
import { useTranslations } from '@/contexts/language-context';
import { Progress } from "@/components/ui/progress";
import { cn } from '@/lib/utils';

const POMODORO_WORK_DURATION_SECONDS = 25 * 60;
const POMODORO_SHORT_BREAK_DURATION_SECONDS = 5 * 60;

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function PomodoroTimerPopover() {
  const {
    pomodoroPhase,
    pomodoroTimeRemaining,
    pomodoroIsRunning,
    startPomodoroWork,
    startPomodoroShortBreak,
    pausePomodoro,
    resumePomodoro,
    resetPomodoro,
  } = useAppStore();
  const { t } = useTranslations();

  const formattedTime = useMemo(() => formatTime(pomodoroTimeRemaining), [pomodoroTimeRemaining]);

  const currentPhaseText = useMemo(() => {
    if (pomodoroPhase === 'work') return t('pomodoroWorkSession');
    if (pomodoroPhase === 'shortBreak') return t('pomodoroShortBreakSession');
    return t('pomodoroReadyToStart');
  }, [pomodoroPhase, t]);

  const progressValue = useMemo(() => {
    const totalDuration = pomodoroPhase === 'work'
      ? POMODORO_WORK_DURATION_SECONDS
      : pomodoroPhase === 'shortBreak'
      ? POMODORO_SHORT_BREAK_DURATION_SECONDS
      : POMODORO_WORK_DURATION_SECONDS; 
    if (totalDuration === 0) return 0;
    return ((totalDuration - pomodoroTimeRemaining) / totalDuration) * 100;
  }, [pomodoroPhase, pomodoroTimeRemaining]);

  const handleMainAction = () => {
    if (pomodoroIsRunning) {
      pausePomodoro();
    } else {
      if (pomodoroPhase === 'off') {
        startPomodoroWork(); 
      } else {
        resumePomodoro();
      }
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t('pomodoroTimerMenuLabel')}>
          <Timer className={`h-5 w-5 ${pomodoroIsRunning ? 'text-primary animate-pulse' : ''}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="end">
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{currentPhaseText}</p>
            <p className="text-4xl font-bold tracking-tighter">{formattedTime}</p>
          </div>

          {pomodoroPhase !== 'off' && (
             <Progress value={progressValue} className="h-2 [&>div]:bg-primary" />
          )}

          <div className="grid grid-cols-1 gap-2">
             <Button onClick={handleMainAction} className="w-full">
              {pomodoroIsRunning ? (
                <>
                  <Pause className="mr-2 h-4 w-4" /> {t('pomodoroPause')}
                </>
              ) : pomodoroPhase !== 'off' ? (
                <>
                  <Play className="mr-2 h-4 w-4" /> {t('pomodoroResume')}
                </>
              ) : (
                 <>
                  <Play className="mr-2 h-4 w-4" /> {t('pomodoroStartWork')}
                </>
              )}
            </Button>
          </div>


          <div className="grid grid-cols-2 gap-2">
            {pomodoroPhase !== 'work' && pomodoroPhase !== 'off' && (
              <Button 
                variant="outline" 
                onClick={startPomodoroWork} 
                size="sm" 
                className={cn(
                  "w-full whitespace-normal h-auto py-1.5 text-center"
                )}
              >
                <Briefcase className="mr-2 h-4 w-4 flex-shrink-0" /> 
                <span>{t('pomodoroStartWork').split('(')[0].trim()}</span>
              </Button>
            )}
            {pomodoroPhase !== 'shortBreak' && pomodoroPhase !== 'off' && (
              <Button 
                variant="outline" 
                onClick={startPomodoroShortBreak} 
                size="sm" 
                className={cn(
                  "w-full whitespace-normal h-auto py-1.5 text-center"
                )}
              >
                <Coffee className="mr-2 h-4 w-4 flex-shrink-0" />
                <span>{t('pomodoroStartShortBreak').split('(')[0].trim()}</span>
              </Button>
            )}
          </div>
          
          {(pomodoroPhase !== 'off' || pomodoroIsRunning) && (
             <Button variant="destructive" onClick={resetPomodoro} size="sm" className="w-full col-span-2">
                <RotateCcw className="mr-2 h-4 w-4" /> {t('pomodoroReset')}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
