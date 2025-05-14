/**
 * app/home/page.tsx
 * This is the home page to open new chats and look at existing chats
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";

import { chatProfile } from "@/drizzle/schema";
import { borderColors, profileDescriptions, profileIcons } from "@/utils/profiles";
import { backgroundColors } from "@/utils/profiles";
import { logout } from "@/utils/mutations/logout";
import { getChats } from "@/utils/queries/get-chats";
import { getRubrics } from "@/utils/queries/get-rubrics";
import { getUser } from "@/utils/queries/get-user";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createChat } from "@/utils/mutations/create-chat";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('new');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    try {
      const { success, error } = await logout();
      if (success) {
        router.push('/');
      } else {
        throw new Error(error);
      }
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setLoading(false);
    }
  }

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => getUser(),
  });


  const { data: chats } = useQuery({
    queryKey: ['chats', user?.id],
    queryFn: () => getChats(user!.id),
    enabled: !!user,
  });

  const { data: rubrics } = useQuery({
    queryKey: ['rubrics', chats?.map((chat) => chat.id)],
    queryFn: () => getRubrics(chats!.map((chat) => chat.id)),
    enabled: !!chats,
  });

  const newCount = chatProfile.enumValues.length
  const passedCount = rubrics?.filter((rubric) => rubric.passed).length;
  const failedCount = rubrics?.filter((rubric) => !rubric.passed).length;

  const handleStartChat = async (profile: typeof chatProfile.enumValues[number]) => {
    try {
      if (!user) {
        throw new Error("User not found");
      }
      // TODO: will need to call the API in practice, having the inital agent and message getting setup
      const { success, error, chatId } = await createChat(profile, user.id);
      if (success) {
        router.push(`/chat/${chatId}`);
      } else {
        throw new Error(error);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">GLOW - GTA Training</h1>
          <div>
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-secondary/50 text-secondary-foreground rounded-md"
              disabled={loading}
            >
              {loading ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        {/* Tab Navigation */}
        <div className="border-b border-border mb-6">
          <nav className="-mb-px flex" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('new')}
              className={`mr-2 px-4 py-2 font-medium text-sm rounded-t-lg border-b-2 ${activeTab === 'new'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
            >
              New
              <span className={`ml-2 py-0.5 px-2.5 text-xs font-medium rounded-full ${activeTab === 'new' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                }`}>
                {newCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('passed')}
              className={`mr-2 px-4 py-2 font-medium text-sm rounded-t-lg border-b-2 ${activeTab === 'passed'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
            >
              Passed
              <span className={`ml-2 py-0.5 px-2.5 text-xs font-medium rounded-full ${activeTab === 'passed' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-800'
                }`}>
                {passedCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('failed')}
              className={`mr-2 px-4 py-2 font-medium text-sm rounded-t-lg border-b-2 ${activeTab === 'failed'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
            >
              Failed
              <span className={`ml-2 py-0.5 px-2.5 text-xs font-medium rounded-full ${activeTab === 'failed' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-800'
                }`}>
                {failedCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('rubric')}
              className={`mr-2 px-4 py-2 font-medium text-sm rounded-t-lg border-b-2 ${activeTab === 'rubric'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
            >
              Rubric
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'new' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {chatProfile.enumValues.map((profile) => (
                <div key={profile}
                  className={`p-6 rounded-lg shadow-md ${backgroundColors[profile]} ${borderColors[profile]} border-2 transition-transform hover:scale-105 cursor-pointer`}
                  onClick={() => handleStartChat(profile)}
                >
                  <div className="flex flex-col items-center">
                    <div className="w-24 h-24 mb-4 rounded-full bg-white flex items-center justify-center relative">
                      <span className="text-4xl">
                        {profileIcons[profile]}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold mb-2">{profile}</h3>
                    <p className="text-center text-sm mb-3">{profileDescriptions[profile]}</p>

                    <div className="mt-4 w-full py-2 text-center rounded-md bg-primary text-primary-foreground">
                      Start Practice
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'rubric' && (
            <div>
              <h3 className="text-xl font-medium mb-4 text-blue-600">Assessment Rubric</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-md">
                  <thead className="bg-primary text-primary-foreground text-left">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Criteria</th>
                      <th className="py-3 px-4 font-semibold">Excellent (4)</th>
                      <th className="py-3 px-4 font-semibold">Proficient (3)</th>
                      <th className="py-3 px-4 font-semibold">Developing (2)</th>
                      <th className="py-3 px-4 font-semibold">Needs Improvement (1)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-medium">Active Listening</td>
                      <td className="py-3 px-4">Demonstrates exceptional attention to student's concerns, repeats and rephrases to confirm understanding</td>
                      <td className="py-3 px-4">Shows consistent engagement with student's concerns, confirms understanding most of the time</td>
                      <td className="py-3 px-4">Some evidence of listening but misses key points, limited confirmation of understanding</td>
                      <td className="py-3 px-4">Minimal attention to student's concerns, frequently interrupts or misunderstands</td>
                    </tr>
                    <tr className="border-b border-border bg-secondary/30">
                      <td className="py-3 px-4 font-medium">Empathy</td>
                      <td className="py-3 px-4">Consistently acknowledges emotions, shows genuine concern and understanding of student's perspective</td>
                      <td className="py-3 px-4">Often recognizes emotions, attempts to understand student's perspective</td>
                      <td className="py-3 px-4">Occasionally acknowledges emotions, limited attempts to understand perspective</td>
                      <td className="py-3 px-4">Rarely acknowledges emotions or dismisses student's concerns</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-medium">Problem Solving</td>
                      <td className="py-3 px-4">Identifies core issues quickly, offers multiple effective solutions, involves student in decision-making</td>
                      <td className="py-3 px-4">Identifies main issues, provides workable solutions, considers student input</td>
                      <td className="py-3 px-4">Partially identifies issues, limited solution options, minimal student involvement</td>
                      <td className="py-3 px-4">Misidentifies issues or provides inappropriate solutions without student input</td>
                    </tr>
                    <tr className="border-b border-border bg-secondary/30">
                      <td className="py-3 px-4 font-medium">Communication Clarity</td>
                      <td className="py-3 px-4">Consistently clear explanations, adapts language to student level, checks comprehension</td>
                      <td className="py-3 px-4">Generally clear explanations, appropriate language for student, occasional comprehension checks</td>
                      <td className="py-3 px-4">Sometimes unclear explanations, inconsistent language level, rare comprehension checks</td>
                      <td className="py-3 px-4">Confusing explanations, inappropriate language level, no comprehension checks</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-medium">Resource Utilization</td>
                      <td className="py-3 px-4">Comprehensive knowledge of resources, provides specific referrals with details</td>
                      <td className="py-3 px-4">Good knowledge of resources, provides general referral information</td>
                      <td className="py-3 px-4">Limited knowledge of resources, vague referral information</td>
                      <td className="py-3 px-4">Minimal knowledge of resources, incorrect or no referral information</td>
                    </tr>
                    <tr className="border-b border-border bg-secondary/30">
                      <td className="py-3 px-4 font-medium">Time Management</td>
                      <td className="py-3 px-4">Efficiently uses time, addresses all concerns, provides closure within appropriate timeframe</td>
                      <td className="py-3 px-4">Good use of time, addresses main concerns, reasonable pacing throughout interaction</td>
                      <td className="py-3 px-4">Inconsistent pacing, spends too much time on minor issues, rushes important topics</td>
                      <td className="py-3 px-4">Poor time management, conversation either too rushed or unnecessarily lengthy</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-medium">Adjusted to Student Type</td>
                      <td className="py-3 px-4">Perfectly adapts approach to match student's personality and needs, uses appropriate strategies</td>
                      <td className="py-3 px-4">Generally adjusts communication style to student type, employs suitable techniques</td>
                      <td className="py-3 px-4">Some attempts to adjust to student type, but inconsistent application of strategies</td>
                      <td className="py-3 px-4">Uses same approach regardless of student type, ignores or misreads personality cues</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">Scoring System</h4>
                <p className="text-sm mb-2">Your interactions with each student type are scored based on the criteria above:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li><span className="font-medium">Pass:</span> Score of 21-28 points (75%+)</li>
                  <li><span className="font-medium">Fail:</span> Score below 21 points</li>
                  <li>Each interaction must score at least 2 points in every criterion to pass</li>
                </ul>
              </div>
            </div>
          )}

          {(activeTab === 'passed' || activeTab === 'failed') && (
            chats && chats.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {chats.map((chat) => (
                  <Link
                    href={`/chat/${chat.id}`}
                    key={chat.id}
                    className={`p-6 rounded-lg shadow-md ${backgroundColors[chat.profile]} ${borderColors[chat.profile]} border-2 transition-transform hover:scale-105`}
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-24 h-24 mb-4 rounded-full bg-white flex items-center justify-center relative">
                        <span className="text-4xl">
                          {profileIcons[chat.profile]}
                        </span>

                        {rubrics?.find((rubric) => rubric.chatId === chat.id)?.passed && (
                          <span className="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center bg-green-500 text-white rounded-full border-2 border-white">
                            ✓
                          </span>
                        )}

                        {!rubrics?.find((rubric) => rubric.chatId === chat.id)?.passed && (
                          <span className="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-full border-2 border-white">
                            ✗
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl font-bold mb-2">{chat.title}</h3>

                      {chat.completed && (
                        <div className="w-full mt-2 text-sm">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Last attempt:</span>
                            <span>{rubrics?.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]?.createdAt}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Score:</span>
                            <span className={rubrics?.find((rubric) => rubric.chatId === chat.id && rubric.passed) ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                              {rubrics?.find((rubric) => rubric.chatId === chat.id)?.score}/100
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Attempts:</span>
                            <span>{rubrics?.filter((rubric) => rubric.chatId === chat.id).length}</span>
                          </div>
                        </div>
                      )}

                      <div className={`mt-4 w-full py-2 text-center rounded-md ${!chat.completed ? 'bg-primary text-primary-foreground' :
                        rubrics?.find((rubric) => rubric.chatId === chat.id && rubric.passed) ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                        {chat.completed ? 'Practice Again' : 'Continue'}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-secondary/30 rounded-lg">
                <p className="text-muted-foreground">No student types in this category.</p>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}