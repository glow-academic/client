// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "ebubdyql-dgcl-jxtn-o46b-oqz3o5cieyn",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "d6df9v5a-6g2e-b6pd-a13u-1rf2pcw1rcp",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2"
  }
];

// TOPICS MOCK DATA
export const topics = [
  {
    "id": "qtqsuih3-k6ta-b9gr-xio6-en7fllvdpv4",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": true,
    "classId": "classId_1"
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "81v9eya4-smla-88vf-z1mn-bcxn9lbpxyr",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "citj5y2b-n7zi-qewj-suog-e9gq5st75k",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "time": "2025-06-24T16:51:28.755Z",
    "scheduleId": "scheduleId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "v1znhi0m-9d0m-a4kg-a4rb-dmsz3kiyqbl",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": false,
    "fileId": "fileId_1"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "u4ywrpah-7j3s-ffcd-amrl-c79eroq83i8",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 42,
    "userId": 69,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 44,
    "idToken": "idToken_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 31,
    "userId": 8,
    "expires": "2025-06-24T16:51:28.755Z",
    "sessionToken": "sessionToken_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "6cwtanex-pjlw-7fl6-2n2t-13ev8jtujh9",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 37,
    "emailVerified": "2025-06-24T16:51:28.755Z",
    "image": "image_1"
  },
  {
    "id": 79,
    "email": "instructional@example.com",
    "emailVerified": "2025-06-24T16:51:28.755Z"
  },
  {
    "id": 60,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "emailVerified": "2025-06-24T16:51:28.755Z"
  },
  {
    "id": 79,
    "name": "TA User",
    "email": "ta@example.com",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "igpcnol4-fwbg-ubun-ccn1-jaslt3hn0tc",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "userId": 37,
    "lastLogin": "2025-06-24T16:51:28.755Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "role": "admin",
    "classIds": [
      "ebubdyql-dgcl-jxtn-o46b-oqz3o5cieyn",
      "d6df9v5a-6g2e-b6pd-a13u-1rf2pcw1rcp"
    ]
  },
  {
    "id": "0hmxstq7-vut7-i8ra-r58q-oapjz0zntqc",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "userId": 79,
    "lastLogin": "2025-06-24T16:51:28.755Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "role": "instructional",
    "classIds": [
      "ebubdyql-dgcl-jxtn-o46b-oqz3o5cieyn",
      "d6df9v5a-6g2e-b6pd-a13u-1rf2pcw1rcp"
    ]
  },
  {
    "id": "tsyvhb6u-klk7-nfzc-q34v-wh6ctak8a7",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "userId": 60,
    "lastLogin": "2025-06-24T16:51:28.755Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "role": "instructor",
    "classIds": [
      "ebubdyql-dgcl-jxtn-o46b-oqz3o5cieyn",
      "d6df9v5a-6g2e-b6pd-a13u-1rf2pcw1rcp"
    ]
  },
  {
    "id": "2q40q8qg-0lhy-v5mx-isp1-2tt8hbmaszm",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "userId": 79,
    "lastLogin": "2025-06-24T16:51:28.755Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "role": "ta",
    "classIds": [
      "ebubdyql-dgcl-jxtn-o46b-oqz3o5cieyn",
      "d6df9v5a-6g2e-b6pd-a13u-1rf2pcw1rcp"
    ]
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "a2fhyzf5-3htr-c1q2-16sx-rbjves3hhg",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 17,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "5q7g66c2-21v2-1ag9-v2lm-vz1prf39r1",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 28,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "722foyxz-qhmm-hx6n-ha1m-gcrb3dxa56g",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 39,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "h95efqj2-9dz8-gwfq-yqki-i9tqkoq1z1",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 66,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 18,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-06-24T16:51:28.755Z"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "t4qsjeho-2jgu-0t9p-gzlo-uro68ur8ro",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "1tecn8c1-2u6s-gz8w-k986-k6mn0j2bnpn",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "completedAt": "2025-06-24T16:51:28.755Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "9fyar95e-0t2v-o82y-y4yu-i9k155w302h",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "completedAt": "2025-06-24T16:51:28.755Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": true
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "ye7xmlwl-i22s-herc-3fdp-f7felprjgwa",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": false,
    "defaultComponent": "defaultComponent_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "dfey2gyt-0kmz-n2zl-e5ok-x8aoan2kccs",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "classId": "classId_1",
    "crowdedness": 93,
    "intensity": 61,
    "seniority": "freshman",
    "defaultScenario": "defaultScenario_1"
  },
  {
    "id": "tydjnicl-spw5-z2af-qoz9-lsbbmmmr73n",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "crowdedness": 100,
    "intensity": 10,
    "defaultScenario": "defaultScenario_2"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "pop6rooi-ksgt-p9tp-x7qf-rcd2e7j2foo",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "headerComponentIds": [
      "headerComponentIds_1"
    ],
    "primaryComponentIds": [
      "primaryComponentIds_1"
    ],
    "secondaryComponentIds": [
      "secondaryComponentIds_1"
    ],
    "footerComponentIds": [
      "footerComponentIds_1"
    ],
    "autoScroll": "autoScroll_1",
    "showIndicators": "showIndicators_1",
    "headerComponents": "headerComponents_1",
    "mainSplit": "mainSplit_1",
    "footerSplit": "footerSplit_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "9lbwoc51-vm7a-jprc-y2xa-d73si3o2fgp",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.88,
    "defaultAgent": "defaultAgent_1",
    "editable": false,
    "reasoning": "low"
  },
  {
    "id": "xr7lnec1-nz73-oxfk-lxqi-1hfgivpib6b",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.61,
    "defaultAgent": "defaultAgent_2",
    "editable": true,
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "cpi3vgbj-nnma-leuo-vbal-7ccywuqzu72",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "igpcnol4-fwbg-ubun-ccn1-jaslt3hn0tc",
      "0hmxstq7-vut7-i8ra-r58q-oapjz0zntqc",
      "tsyvhb6u-klk7-nfzc-q34v-wh6ctak8a7",
      "2q40q8qg-0lhy-v5mx-isp1-2tt8hbmaszm"
    ]
  },
  {
    "id": "ftsru927-3old-51kj-g8ln-ea8lpw71025",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "igpcnol4-fwbg-ubun-ccn1-jaslt3hn0tc",
      "0hmxstq7-vut7-i8ra-r58q-oapjz0zntqc",
      "tsyvhb6u-klk7-nfzc-q34v-wh6ctak8a7",
      "2q40q8qg-0lhy-v5mx-isp1-2tt8hbmaszm"
    ]
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "0wicajpp-qst7-pzbr-owou-pyrrx5b8grf",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "dfey2gyt-0kmz-n2zl-e5ok-x8aoan2kccs",
      "tydjnicl-spw5-z2af-qoz9-lsbbmmmr73n"
    ],
    "cohortIds": [
      "cpi3vgbj-nnma-leuo-vbal-7ccywuqzu72",
      "ftsru927-3old-51kj-g8ln-ea8lpw71025"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "33z3lhtg-qshu-lyd7-uioe-x82b1wv4dsb",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "dfey2gyt-0kmz-n2zl-e5ok-x8aoan2kccs",
      "tydjnicl-spw5-z2af-qoz9-lsbbmmmr73n"
    ],
    "cohortIds": [
      "cpi3vgbj-nnma-leuo-vbal-7ccywuqzu72",
      "ftsru927-3old-51kj-g8ln-ea8lpw71025"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "mlh1pem5-j7ns-s3o6-y022-6vf52esei6w",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "ca1h6393-b4i0-td8s-jh1y-nhsyqgb93yd",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "completedAt": "2025-06-24T16:51:28.755Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "bj0175h8-3439-568p-0ub0-zx5j7o8tch",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "y96surqg-96r4-v974-3ekp-bpn61m92m8r",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "passed": false,
    "score": 54,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "jnkoqfwx-ypei-t69u-rorc-vq3rfgj69fm",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 61,
    "feedback": "feedback_1"
  }
];

// EVALS MOCK DATA
export const evals = [
  {
    "id": "39j26b2y-og41-xldl-3os1-jv8ql2xebhb",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "name": "Math Skills Evaluation",
    "description": "Comprehensive evaluation of mathematical problem-solving abilities",
    "baseAgentId": "baseAgentId_1",
    "scenarioIds": [
      "dfey2gyt-0kmz-n2zl-e5ok-x8aoan2kccs",
      "tydjnicl-spw5-z2af-qoz9-lsbbmmmr73n"
    ],
    "agentIds": [
      "9lbwoc51-vm7a-jprc-y2xa-d73si3o2fgp",
      "xr7lnec1-nz73-oxfk-lxqi-1hfgivpib6b"
    ],
    "rubricIds": [
      "a2fhyzf5-3htr-c1q2-16sx-rbjves3hhg",
      "5q7g66c2-21v2-1ag9-v2lm-vz1prf39r1"
    ],
    "maxTurns": "maxTurns_1",
    "startOnCreation": "startOnCreation_1"
  }
];

// EVALRUNS MOCK DATA
export const evalRuns = [
  {
    "id": "g3iwhje6-l5o1-j2xw-2ibl-hw7j1h1w0gd",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "evalId": "evalId_1",
    "agentId": "agentId_1",
    "rubricId": "rubricId_1"
  }
];

// EVALCHATS MOCK DATA
export const evalChats = [
  {
    "id": "atc1xfk1-5gbu-4gqz-sbjg-mi695a25xy",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "updatedAt": "2025-06-24T16:51:28.755Z",
    "title": "Eval_chats 1",
    "scenarioId": "scenarioId_1",
    "evalRunId": "evalRunId_1",
    "completed": true,
    "traceId": "traceId_1"
  }
];

// EVALMESSAGES MOCK DATA
export const evalMessages = [
  {
    "id": "148a0p79-x2ca-lulw-5o60-ehmefovnao9",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// EVALCHATGRADES MOCK DATA
export const evalChatGrades = [
  {
    "id": "g3uzea91-pwod-lloi-x660-g2s8mj0b9av",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "passed": false,
    "score": 86,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "evalChatId": "evalChatId_1"
  }
];

// EVALCHATFEEDBACKS MOCK DATA
export const evalChatFeedbacks = [
  {
    "id": "h0em5q0w-qpsp-7cr9-f2yh-5fmamy0jvyl",
    "createdAt": "2025-06-24T16:51:28.755Z",
    "standardId": "standardId_1",
    "evalChatGradeId": "evalChatGradeId_1",
    "total": 16,
    "feedback": "feedback_1"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-06-24T16:51:28.755Z",
    "token": "token_1"
  }
];

