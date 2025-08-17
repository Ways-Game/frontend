import { useState, useEffect, useCallback } from 'react'

interface UseLiveTimerReturn {
  isActive: boolean
  timeLeft: number
  startTimer: () => void
}

export const useLiveTimer = (duration: number = 30): UseLiveTimerReturn => {
  const [isActive, setIsActive] = useState(false)
  const [timeLeft, setTimeLeft] = useState(duration)

  const startTimer = useCallback(() => {
    setIsActive(true)
    setTimeLeft(duration)
  }, [duration])

  useEffect(() => {
    let intervalId: NodeJS.Timeout

    if (isActive && timeLeft > 0) {
      intervalId = setInterval(() => {
        setTimeLeft((time) => {
          if (time <= 1) {
            setIsActive(false)
            return duration
          }
          return time - 1
        })
      }, 1000)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [isActive, timeLeft, duration])

  // Auto-start timer every 30 seconds
  useEffect(() => {
    const autoStartInterval = setInterval(() => {
      if (!isActive) {
        startTimer()
      }
    }, (duration + 5) * 1000) // Add 5 second buffer

    // Start immediately
    startTimer()

    return () => clearInterval(autoStartInterval)
  }, [startTimer, isActive, duration])

  return {
    isActive,
    timeLeft,
    startTimer
  }
}