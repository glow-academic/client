// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 44,
    "userId": 9,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "expiresAt": 44,
    "idToken": "idToken_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 98,
    "userId": 79,
    "expires": "2025-07-24T23:29:26.573Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "n6genwg9-kt9y-b5u7-2438-wqvbpwuzfob",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": true,
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 70,
    "name": "Admin User",
    "email": "admin@example.com"
  },
  {
    "id": 95,
    "name": "Instructional User",
    "emailVerified": "2025-07-24T23:29:26.573Z"
  },
  {
    "id": 90,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "emailVerified": "2025-07-24T23:29:26.573Z",
    "image": "image_3"
  },
  {
    "id": 38
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "ky790yrd-8nnn-loky-jh3b-eqax1xe7wnj",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "userId": 70,
    "lastLogin": "2025-07-24T23:29:26.573Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-24T23:29:26.573Z"
  },
  {
    "id": "irrqx0cp-6jmp-odkm-4n6q-6bs72z7pexh",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "lastLogin": "2025-07-24T23:29:26.573Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-24T23:29:26.573Z",
    "userId": 95
  },
  {
    "id": "r3r6iy5o-xnay-joj5-9nvq-fgc552vcu6n",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "userId": 90,
    "lastLogin": "2025-07-24T23:29:26.573Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-24T23:29:26.573Z"
  },
  {
    "id": "y4l9mztj-qdy2-bd05-03t7-zhpleft14dp",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "userId": 38,
    "lastLogin": "2025-07-24T23:29:26.573Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-24T23:29:26.573Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "lnjlvei8-ldi4-fumm-urac-hngg8f4hw8p",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "ercno23j-jldj-nrk8-a5n1-sffv84ukdl",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "nfuxbkgh-aui2-wctg-8n7r-mrw7yjoqrhi",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 12,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "6uonanm9-6a0w-p876-dve3-5rb5fb3ba28",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 95,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "7pnl8pa1-b8vw-ttv5-d45g-op358fysw1k",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 55,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 60,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-24T23:29:26.573Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "5s1dr0ni-syxv-gn2d-h7ze-0ndarlhfd5hf",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 49,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 67,
    "createdAt": "2025-07-24T23:29:26.573Z",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "t0t167pm-rl7x-lwm6-6g55-5sw1ny3vlf",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "wtu9hqnu-t31n-rf5t-qlbn-lcud0s10wye",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "4m7zpvi3-rouj-xmsy-lbwu-cb1qgavlvud",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "completedAt": "2025-07-24T23:29:26.573Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": true
  }
];

// PERSONAS MOCK DATA
export const personas = [
  {
    "id": "w67xrd84-8vn0-ourd-gjvb-3z0qr1b9aya",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.19,
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "modelId": "modelId_1",
    "reasoning": "low"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "oj85915r-xwll-2n54-zejp-xdw0u7z1na",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.13,
    "modelId": "modelId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "q1eybph9-cdsg-p53a-m101-2kxmhos29gi",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "personaId": "personaId_1",
    "crowdedness": 18,
    "intensity": 79,
    "classId": "classId_1",
    "locationId": "locationId_1",
    "deadlineId": "deadlineId_1",
    "timeId": "timeId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true,
    "parentId": "parentId_1",
    "active": true
  },
  {
    "id": "podbhxp5-l8jv-40eo-gol2-gyfl3nwfk0f",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "classId": "classId_2",
    "deadlineId": "deadlineId_2",
    "timeId": "timeId_2",
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": true,
    "parentId": "parentId_2",
    "active": false
  }
];

// SCENARIOCLASSES MOCK DATA
export const scenarioClasses = [
  {
    "id": "u3tnx63n-xrxz-xxpq-6hzx-3multm5gxtr",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "name": "Scenario_classes 1",
    "classCode": "classCode_1",
    "description": "Description for scenario_classes 1"
  }
];

// SCENARIOLOCATIONS MOCK DATA
export const scenarioLocations = [
  {
    "id": "xhs4w8ay-mkln-uw9k-9fny-rsyk7cxmj98",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "name": "Scenario_locations 1",
    "description": "Description for scenario_locations 1"
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "wc2ffer2-egbq-710f-h12m-60o56uqca0y",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "deadline": "deadline_1",
    "description": "Description for scenario_deadlines 1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "hddcycnh-ocdr-ntf3-rbis-8f6zv459sb2",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "timeOfDay": "timeOfDay_1",
    "description": "Description for scenario_times 1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "zry5l5cl-xvt9-umt9-sl9o-wqq1da086bk",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "title": "Math Practice Simulation",
    "active": true,
    "scenarioIds": [
      "q1eybph9-cdsg-p53a-m101-2kxmhos29gi",
      "podbhxp5-l8jv-40eo-gol2-gyfl3nwfk0f"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "sjz2dxie-oyeu-gj62-lz71-rgkendswr9r",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "q1eybph9-cdsg-p53a-m101-2kxmhos29gi",
      "podbhxp5-l8jv-40eo-gol2-gyfl3nwfk0f"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "kdr5rfkx-mpve-v8wd-m8tw-jl1zcvpzvk",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "6e1g4dsp-prsr-lua4-d1g6-t388kkfu6p",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "completedAt": "2025-07-24T23:29:26.573Z",
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
    "id": "mw60tl28-bvvn-xngz-wss5-ebm4d6kve6s",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "xgph860t-vtmk-vwhu-lp1q-6up8nzno9q5",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "passed": false,
    "score": 39,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "9z2cgjxh-u8s8-satj-u53r-ztah63wply",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 61,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "ie9prf6d-gqy6-qpit-6pc3-zvebk3hvuk",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "ky790yrd-8nnn-loky-jh3b-eqax1xe7wnj",
      "irrqx0cp-6jmp-odkm-4n6q-6bs72z7pexh",
      "r3r6iy5o-xnay-joj5-9nvq-fgc552vcu6n",
      "y4l9mztj-qdy2-bd05-03t7-zhpleft14dp"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "zry5l5cl-xvt9-umt9-sl9o-wqq1da086bk",
      "sjz2dxie-oyeu-gj62-lz71-rgkendswr9r"
    ]
  },
  {
    "id": "21lns6zz-tj28-pf86-g7j7-3y6c6zwey1",
    "createdAt": "2025-07-24T23:29:26.573Z",
    "updatedAt": "2025-07-24T23:29:26.573Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "ky790yrd-8nnn-loky-jh3b-eqax1xe7wnj",
      "irrqx0cp-6jmp-odkm-4n6q-6bs72z7pexh",
      "r3r6iy5o-xnay-joj5-9nvq-fgc552vcu6n",
      "y4l9mztj-qdy2-bd05-03t7-zhpleft14dp"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "zry5l5cl-xvt9-umt9-sl9o-wqq1da086bk",
      "sjz2dxie-oyeu-gj62-lz71-rgkendswr9r"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-24T23:29:26.573Z",
    "token": "token_1"
  }
];

