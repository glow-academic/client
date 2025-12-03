/**
 * VideoAttemptView.tsx
 * Video-based attempt view with full-screen video player, timestamp-based questions, and policy display
 * @AshokSaravanan222 & @siladiea
 * 01/30/2025
 */
"use client";

import type {
  AttemptFullOut,
  CreateQuizIn,
  CreateQuizOut,
  SubmitQuizResponseIn,
  SubmitQuizResponseOut,
  CompleteQuizIn,
  CompleteQuizOut,
} from "@/app/(main)/home/a/[attemptId]/page";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Icons
import {
  CheckCircle2,
  Clock,
  FileText,
  ListChecks,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";

import PolicyViewer from "@/components/common/chat/viewers/PolicyViewer";
import { formatTime } from "@/utils/time";
import VideoQuestionPopover from "./VideoQuestionPopover";

// Extract types from AttemptFullOut
type ContentItem = AttemptFullOut["content"][number];
type VideoItem = NonNullable<ContentItem["video"]>;
type QuizItem = NonNullable<ContentItem["quiz"]>;
type QuestionItem = ContentItem["questions"][number];
type QuizResponseItem = NonNullable<QuizItem>["responses"][number];

interface VideoAttemptViewProps {
  attemptId: string;
  contentItem: ContentItem;
  policies: AttemptFullOut["scenarioDocuments"];
  currentContentIndex: number;
  expectedContentCount: number;
  isAttemptOwner: boolean;
  onVideoComplete: (quizId: string) => void;
  onSubmitQuizResponse: (
    quizId: string,
    questionId: string,
    optionId: string,
    isCorrect: boolean
  ) => void;
  onContinue: () => void;
  onPrevious: () => void;
}

export default function VideoAttemptView({
  attemptId,
  contentItem,
  policies,
  currentContentIndex,
  expectedContentCount,
  isAttemptOwner,
  onVideoComplete,
  onSubmitQuizResponse,
  onContinue,
  onPrevious,
}: VideoAttemptViewProps) {
  const video = contentItem.video;
  const questions = contentItem.questions;
  const quiz = contentItem.quiz;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(false);

  // Get questions sorted by first timestamp
  const sortedQuestions = useMemo(() => {
    if (!questions || questions.length === 0) return [];
    return [...questions].sort((a, b) => {
      const aTime = a.times && a.times.length > 0 ? a.times[0] : Infinity;
      const bTime = b.times && b.times.length > 0 ? b.times[0] : Infinity;
      return aTime - bTime;
    });
  }, [questions]);

  // Track which questions have been answered correctly
  useEffect(() => {
    if (!quiz?.responses || !questions || questions.length === 0) return;

    const answered = new Set<string>();
    const answers: Record<string, string> = {};

    quiz.responses.forEach((response) => {
      if (response.completed) {
        answered.add(response.questionId);
        answers[response.questionId] = response.optionId;
      }
    });

    setAnsweredQuestions(answered);
    setQuestionAnswers(answers);

    // Check if all questions are answered correctly
    const allAnswered = questions.every((q) => answered.has(q.id));
    setAllQuestionsAnswered(allAnswered);
  }, [quiz?.responses, questions]);

  // Check if video is completed (watched to end + all questions answered correctly)
  useEffect(() => {
    if (videoCompleted && allQuestionsAnswered && quiz?.completed) {
      // Video is fully completed
    }
  }, [videoCompleted, allQuestionsAnswered, quiz?.completed]);

  // Handle video time updates to show questions at timestamps
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !questions || questions.length === 0) return;

    const currentTimeSeconds = Math.floor(videoRef.current.currentTime);
    setCurrentTime(currentTimeSeconds);

    // Find question that should appear at this timestamp
    for (const question of sortedQuestions) {
      if (question.times && question.times.includes(currentTimeSeconds)) {
        // Check if question already answered correctly
        if (!answeredQuestions.has(question.id) && activeQuestionId !== question.id) {
          // Pause video and show question
          if (videoRef.current) {
            videoRef.current.pause();
            setIsPlaying(false);
            setActiveQuestionId(question.id);
          }
          break;
        }
      }
    }
  }, [sortedQuestions, answeredQuestions, questions, activeQuestionId]);

  // Handle video ended
  const handleVideoEnded = useCallback(() => {
    setVideoCompleted(true);
    setIsPlaying(false);
  }, []);

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      // Check if there's an unanswered question at current time
      const currentTimeSeconds = Math.floor(videoRef.current.currentTime);
      const unansweredQuestion = sortedQuestions.find(
        (q) =>
          q.times &&
          q.times.includes(currentTimeSeconds) &&
          !answeredQuestions.has(q.id)
      );

      if (unansweredQuestion) {
        setActiveQuestionId(unansweredQuestion.id);
        return;
      }

      videoRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying, sortedQuestions, answeredQuestions]);

  // Handle question answer submission via callback
  const handleQuestionAnswered = useCallback(
    (questionId: string, optionId: string, isCorrect: boolean) => {
      if (!quiz) return;
      onSubmitQuizResponse(quiz.id, questionId, optionId, isCorrect);
      if (isCorrect) {
        setAnsweredQuestions((prev) => new Set(prev).add(questionId));
        setQuestionAnswers((prev) => ({ ...prev, [questionId]: optionId }));
        setActiveQuestionId(null);
        // Resume video if it was paused
        if (videoRef.current && !isPlaying) {
          videoRef.current.play();
          setIsPlaying(true);
        }
      }
    },
    [quiz, onSubmitQuizResponse, isPlaying]
  );

  // Check if all questions are answered correctly
  useEffect(() => {
    if (
      questions &&
      questions.length > 0 &&
      answeredQuestions.size === questions.length &&
      quiz &&
      !quiz.completed
    ) {
      onVideoComplete(quiz.id);
    }
  }, [questions, answeredQuestions, quiz, onVideoComplete]);

  // Get video URL
  const videoUrl = useMemo(() => {
    if (!video?.uploadId) return null;
    return `/api/uploads/download/${video.uploadId}`;
  }, [video?.uploadId]);

  // Check if continue button should be enabled
  const canContinue = useMemo(() => {
    return videoCompleted && allQuestionsAnswered && (quiz?.completed || false);
  }, [videoCompleted, allQuestionsAnswered, quiz?.completed]);

  if (!video) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <p className="text-muted-foreground">No video data available</p>
      </div>
    );
  }

  return (
    <div
      className="h-[calc(100vh-4rem)]"
      data-testid="video-attempt-container"
      data-attempt-id={attemptId || ""}
    >
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Main Video Area */}
        <ResizablePanel
          defaultSize={showPolicies && videoPolicies.length > 0 ? 70 : 100}
          className="md:flex-none"
        >
          <Card className="h-full flex flex-col py-2 border-0 rounded-t-xl rounded-b-none">
            <TooltipProvider>
              <div className="h-full flex flex-col">
                {/* Header with title, timer, and controls */}
                <Collapsible
                  open={showObjectives}
                  onOpenChange={setShowObjectives}
                  className="border-b"
                >
                  <div className="p-2 pt-0 flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-start gap-2">
                          <span className="font-medium">
                            {video.title || currentChat?.title}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-start justify-end gap-2">
                        <div className="flex items-center gap-4">
                          {/* Objectives Toggle */}
                          {video.showObjectives && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <CollapsibleTrigger asChild>
                                  <Button
                                    variant={
                                      showObjectives ? "default" : "outline"
                                    }
                                    size="sm"
                                    onClick={(e) => {
                                      if (window.innerWidth < 768) {
                                        e.preventDefault();
                                        setShowObjectivesModal(true);
                                      }
                                    }}
                                    className={`p-2 ${showObjectives ? "bg-primary text-primary-foreground" : ""}`}
                                  >
                                    <ListChecks className="h-4 w-4" />
                                  </Button>
                                </CollapsibleTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {showObjectives
                                    ? "Hide Objectives"
                                    : "Show Objectives"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* Policies Toggle */}
                          {videoPolicies.length > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={
                                    showPolicies || showPolicyModal
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  onClick={() => {
                                    if (window.innerWidth < 768) {
                                      setShowPolicyModal(true);
                                    } else {
                                      setShowPolicies(!showPolicies);
                                    }
                                  }}
                                  className={`p-2 ${showPolicies || showPolicyModal ? "bg-primary text-primary-foreground" : ""}`}
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {showPolicies || showPolicyModal
                                    ? "Hide Policies"
                                    : "Show Policies"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* Timer */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2 px-3 py-1 rounded-full w-[85px] overflow-x-auto bg-muted">
                                <Clock className="h-4 w-4 flex-shrink-0" />
                                <span className="text-sm font-medium" data-testid="timer">
                                  {timer.remaining !== null
                                    ? formatTime(timer.remaining)
                                    : formatTime(timer.elapsed)}
                                </span>
                              </div>
                            </TooltipTrigger>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Objectives Collapsible Content */}
                  {video.showObjectives && (
                    <CollapsibleContent className="pt-2">
                      <div className="px-4 pb-2">
                        <p className="text-sm text-muted-foreground">
                          Video objectives will be displayed here when available.
                        </p>
                      </div>
                    </CollapsibleContent>
                  )}
                </Collapsible>

                {/* Video Player Area */}
                <div className="flex-1 flex flex-col min-h-0 relative">
                  {videoUrl ? (
                    <div className="flex-1 bg-black rounded-lg relative overflow-hidden">
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        className="w-full h-full object-contain"
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={handleVideoEnded}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        volume={isMuted ? 0 : volume}
                        muted={isMuted}
                      />

                      {/* Video Controls Overlay */}
                      <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handlePlayPause}
                          disabled={activeQuestionId !== null}
                        >
                          {isPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>

                        <div className="flex-1 bg-white/20 rounded-full h-2 relative">
                          <div
                            className="bg-white h-full rounded-full transition-all"
                            style={{
                              width: video
                                ? `${(currentTime / video.lengthSeconds) * 100}%`
                                : "0%",
                            }}
                          />
                        </div>

                        <span className="text-white text-sm">
                          {formatTime(currentTime)} / {formatTime(video.lengthSeconds)}
                        </span>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setIsMuted(!isMuted)}
                        >
                          {isMuted ? (
                            <VolumeX className="h-4 w-4" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      {/* Question Popovers */}
                      {activeQuestionId && (() => {
                        const question = sortedQuestions.find(
                          (q) => q.id === activeQuestionId
                        );
                        if (!question) return null;

                        return (
                          <VideoQuestionPopover
                            key={question.id}
                            question={question}
                            quizResponses={quiz?.responses || []}
                            onSubmitAnswer={handleQuestionAnswered}
                            onClose={() => {
                              setActiveQuestionId(null);
                              if (videoRef.current && !isPlaying) {
                                videoRef.current.play();
                                setIsPlaying(true);
                              }
                            }}
                          />
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center bg-muted rounded-lg">
                      <p className="text-muted-foreground">No video file available</p>
                    </div>
                  )}

                  {/* Problem Statement (if show_problem_statement is true) */}
                  {video.showProblemStatement && (
                    <div className="mt-4 px-4">
                      <p className="text-sm text-muted-foreground">
                        Problem statement will be displayed here when available.
                      </p>
                    </div>
                  )}
                </div>

                {/* Continue/Previous Buttons */}
                <div className="p-4 border-t flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={onPrevious}
                    disabled={!onPrevious}
                  >
                    Previous
                  </Button>

                  <Button
                    variant="default"
                    onClick={handleContinue}
                    disabled={!canContinue}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </TooltipProvider>
          </Card>
        </ResizablePanel>

        {/* Right Panel - Policies */}
        {showPolicies && videoPolicies.length > 0 && (
          <>
            <ResizableHandle className="bg-transparent hidden md:block" />
            <ResizablePanel
              defaultSize={30}
              minSize={20}
              maxSize={50}
              className="hidden md:block"
            >
              <Card className="h-full flex flex-col ml-2 p-0 border-0 border-l-0 shadow-none rounded-l-none">
                <CardContent className="flex-1 p-0 min-h-0 flex flex-col">
                  {/* Policy Select dropdown */}
                  {videoPolicies.length > 1 && (
                    <div className="p-2 pb-1.5 border-b">
                      <select
                        value={selectedPolicyId || videoPolicies[0]?.id || ""}
                        onChange={(e) => setSelectedPolicyId(e.target.value)}
                        className="w-full p-2 border rounded"
                      >
                        {videoPolicies.map((policy) => (
                          <option key={policy.id} value={policy.id}>
                            {policy.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* Policy viewer */}
                  <div className="flex-1 min-h-0 px-1 py-3">
                    {selectedPolicyId &&
                      (() => {
                        const policy =
                          videoPolicies.find(
                            (p) => p.id === selectedPolicyId
                          ) || videoPolicies[0];
                        return policy ? (
                          <PolicyViewer
                            key={selectedPolicyId}
                            policy={{
                              policy_id: policy.id,
                              name: policy.name,
                              description: policy.description,
                              file_path: policy.filePath || null,
                              mime_type: policy.mimeType || null,
                              upload_id: policy.uploadId || null,
                            }}
                          />
                        ) : null;
                      })()}
                  </div>
                </CardContent>
              </Card>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Policy Modal - Mobile Only */}
      <Dialog open={showPolicyModal} onOpenChange={setShowPolicyModal}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] md:overflow-hidden overflow-auto flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {videoPolicies.find((p) => p.id === selectedPolicyId)?.name ||
                videoPolicies[0]?.name ||
                "Policy"}
            </DialogTitle>
            <DialogDescription>View policy document</DialogDescription>
          </DialogHeader>

          {/* Policy selector (if multiple policies) */}
          {videoPolicies.length > 1 && (
            <div className="pb-3">
              <select
                value={selectedPolicyId || videoPolicies[0]?.id || ""}
                onChange={(e) => setSelectedPolicyId(e.target.value)}
                className="w-full p-2 border rounded"
              >
                {videoPolicies.map((policy) => (
                  <option key={policy.id} value={policy.id}>
                    {policy.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Policy viewer */}
          {selectedPolicyId && (
            <div className="flex-1 overflow-auto">
              {(() => {
                const policy =
                  videoPolicies.find((p) => p.id === selectedPolicyId) ||
                  videoPolicies[0];
                return policy ? (
                  <PolicyViewer
                    policy={{
                      policy_id: policy.id,
                      name: policy.name,
                      description: policy.description,
                      file_path: policy.filePath || null,
                      mime_type: policy.mimeType || null,
                      upload_id: null,
                    }}
                    bare={true}
                  />
                ) : null;
              })()}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPolicyModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Objectives Modal - Mobile Only */}
      <Dialog open={showObjectivesModal} onOpenChange={setShowObjectivesModal}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-auto flex flex-col">
          <DialogHeader>
            <DialogTitle>Learning Objectives</DialogTitle>
            <DialogDescription>
              View the learning objectives for this video
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            <p className="text-sm text-muted-foreground italic">
              Video objectives will be displayed here when available.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowObjectivesModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

