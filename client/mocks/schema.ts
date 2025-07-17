// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "3k26ozvl-lkvh-587j-tyes-58s5bbnaem3",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "b4thfrpk-6fn8-x78n-5ay7-r8tqi9rbd5g",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
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
    "id": "u84tlgk8-nwdw-bed0-xjha-4f0bjxe2kd9",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": true,
    "classId": "classId_1"
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "x3x4v9su-aulw-07nr-dys8-rhjsdndapcm",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "m8w8jg1t-9ymq-g6ev-p9ny-eb0sy9i7gj",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "documentType": "documentType_1",
    "time": "2025-07-17T16:57:30.759Z",
    "scheduleId": "scheduleId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "ee8l95y0-bavc-hmkk-djba-cvq4p2fpe9h",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": true,
    "fileId": "fileId_1"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "k9vd8lwp-zynp-4evk-258r-en76460aiz4",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 60,
    "userId": 36,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "expiresAt": 45,
    "idToken": "idToken_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 64,
    "userId": 81,
    "expires": "2025-07-17T16:57:30.759Z",
    "sessionToken": "sessionToken_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "n2da4s8p-4h2s-z5iq-icjx-w2oprgkn85",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 74,
    "name": "Admin User",
    "emailVerified": "2025-07-17T16:57:30.759Z",
    "image": "image_1"
  },
  {
    "id": 3,
    "email": "instructional@example.com",
    "emailVerified": "2025-07-17T16:57:30.759Z"
  },
  {
    "id": 70,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "emailVerified": "2025-07-17T16:57:30.759Z"
  },
  {
    "id": 50,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-07-17T16:57:30.759Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "h89dr5jc-dnuq-qd99-6hgu-ifsziqjdx0p",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "lastLogin": "2025-07-17T16:57:30.759Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "role": "admin",
    "classIds": [
      "3k26ozvl-lkvh-587j-tyes-58s5bbnaem3",
      "b4thfrpk-6fn8-x78n-5ay7-r8tqi9rbd5g"
    ],
    "active": true,
    "lastActive": "2025-07-17T16:57:30.759Z",
    "userId": 74
  },
  {
    "id": "ltmbbhcx-kxkw-nbcs-tvsy-t1f1gsvnpj",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "userId": 3,
    "lastLogin": "2025-07-17T16:57:30.759Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "role": "instructional",
    "classIds": [
      "3k26ozvl-lkvh-587j-tyes-58s5bbnaem3",
      "b4thfrpk-6fn8-x78n-5ay7-r8tqi9rbd5g"
    ],
    "active": false,
    "lastActive": "2025-07-17T16:57:30.759Z"
  },
  {
    "id": "wvlcq0x3-8951-ztdr-6v7v-9k94b9mjabj",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "userId": 70,
    "lastLogin": "2025-07-17T16:57:30.759Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "role": "instructor",
    "classIds": [
      "3k26ozvl-lkvh-587j-tyes-58s5bbnaem3",
      "b4thfrpk-6fn8-x78n-5ay7-r8tqi9rbd5g"
    ],
    "active": false,
    "lastActive": "2025-07-17T16:57:30.759Z"
  },
  {
    "id": "cbxtu276-u3o7-nz3l-hfno-ke14lsucx9s",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "lastLogin": "2025-07-17T16:57:30.759Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "role": "ta",
    "classIds": [
      "3k26ozvl-lkvh-587j-tyes-58s5bbnaem3",
      "b4thfrpk-6fn8-x78n-5ay7-r8tqi9rbd5g"
    ],
    "active": false,
    "lastActive": "2025-07-17T16:57:30.759Z",
    "userId": 50
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "jv6ulbiq-7j6b-iamb-1uvz-ajo8c0793w",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 24,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "uwvpnujv-n45p-gwzh-urcl-eon0vvxzry5",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 70,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "b6b6dy2d-dn1l-ur2m-9g5c-jfvpg8d5xkk",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 4,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "sul6zufs-uv30-pncs-y64o-jq6vgo94upb",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 2,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 8,
    "level": "level_1",
    "context": {},
    "createdAt": "2025-07-17T16:57:30.759Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 57,
    "createdAt": "2025-07-17T16:57:30.759Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "mi0e9u1z-ig7k-fm4k-1yvh-ogfhb7jqw5",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "rh5rl8ve-f1lj-3h99-h6cp-8dl0i3yjqtv",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "crowdedness": 77,
    "intensity": 38,
    "seniority": "freshman",
    "location": "lawson",
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": false
  },
  {
    "id": "bkz11o0k-hgda-ca50-xp9x-6bsc2tq7xw3",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "classId": "classId_2",
    "seniority": "sophomore",
    "location": "haas",
    "tod": "10AM",
    "urgency": "day",
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "amgymk08-z1he-wnbn-5tys-426guj3acz4",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "6zrijgb7-7nxt-inwz-f4gy-j9cbyjllok",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "completedAt": "2025-07-17T16:57:30.759Z",
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
    "id": "3zdtu3zg-fwu3-a1z7-m7qy-ljapbrg340q",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": true,
    "defaultComponent": "defaultComponent_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "17g1zyvf-qy3o-kyi6-a99h-z23760td82",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.32,
    "defaultAgent": "defaultAgent_1",
    "editable": true,
    "modelId": "modelId_1",
    "reasoning": "low"
  },
  {
    "id": "n1tecavy-4em8-w0ge-3vuz-wt7z1dxf2id",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.72,
    "defaultAgent": "defaultAgent_2",
    "editable": true,
    "modelId": "modelId_2"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "3xu4dt7h-scal-maeh-ulxq-d7j2wzg2li6",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "profileId": "profileId_1",
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

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "g4hnzad9-sk2r-jeu4-mduv-xw9d2exjb2",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "h89dr5jc-dnuq-qd99-6hgu-ifsziqjdx0p",
      "ltmbbhcx-kxkw-nbcs-tvsy-t1f1gsvnpj",
      "wvlcq0x3-8951-ztdr-6v7v-9k94b9mjabj",
      "cbxtu276-u3o7-nz3l-hfno-ke14lsucx9s"
    ],
    "defaultCohort": "defaultCohort_1"
  },
  {
    "id": "un6w9kti-1fyw-zpt9-xp5s-8gklfrmnsm",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "h89dr5jc-dnuq-qd99-6hgu-ifsziqjdx0p",
      "ltmbbhcx-kxkw-nbcs-tvsy-t1f1gsvnpj",
      "wvlcq0x3-8951-ztdr-6v7v-9k94b9mjabj",
      "cbxtu276-u3o7-nz3l-hfno-ke14lsucx9s"
    ],
    "defaultCohort": "defaultCohort_2"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "z6fyznxd-9h9s-oyg6-es8u-0lqfqp7fjauc",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "rh5rl8ve-f1lj-3h99-h6cp-8dl0i3yjqtv",
      "bkz11o0k-hgda-ca50-xp9x-6bsc2tq7xw3"
    ],
    "cohortIds": [
      "g4hnzad9-sk2r-jeu4-mduv-xw9d2exjb2",
      "un6w9kti-1fyw-zpt9-xp5s-8gklfrmnsm"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "fzljfwaf-dbiu-vcir-gm70-wpilgjq9jie",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "rh5rl8ve-f1lj-3h99-h6cp-8dl0i3yjqtv",
      "bkz11o0k-hgda-ca50-xp9x-6bsc2tq7xw3"
    ],
    "cohortIds": [
      "g4hnzad9-sk2r-jeu4-mduv-xw9d2exjb2",
      "un6w9kti-1fyw-zpt9-xp5s-8gklfrmnsm"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "rx7xwp6k-vnfp-diyq-zv7t-ge8vkbbm7o",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "8m6dnozp-7ase-xr6f-lwkd-slglx26k0n",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false,
    "traceId": "traceId_1"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "ax1f2fq1-lnxd-ynf7-zjy6-xytpfn6lqv",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "updatedAt": "2025-07-17T16:57:30.759Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "m25oc0np-19qm-24he-s9x0-4p7oq3la3w",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "passed": false,
    "score": 42,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "3y9klys7-oofj-p45x-tek5-j3spcnanxfr",
    "createdAt": "2025-07-17T16:57:30.759Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 30
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-17T16:57:30.759Z",
    "token": "token_1"
  }
];

