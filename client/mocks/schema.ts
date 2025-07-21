// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 63,
    "userId": 99,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 8,
    "scope": "scope_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 60,
    "userId": 90,
    "expires": "2025-07-21T16:56:46.211Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "7hiber1w-1k2h-gk6k-zak6-uuhf3avbrks",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": true,
    "fileId": "fileId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 98,
    "name": "Admin User",
    "email": "admin@example.com",
    "image": "image_1"
  },
  {
    "id": 51,
    "email": "instructional@example.com",
    "image": "image_2"
  },
  {
    "id": 10,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "emailVerified": "2025-07-21T16:56:46.211Z"
  },
  {
    "id": 12,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-07-21T16:56:46.211Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "moydpjrs-5lg0-1nfj-wzds-aig64h0tpig",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "userId": 98,
    "lastLogin": "2025-07-21T16:56:46.211Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-21T16:56:46.211Z"
  },
  {
    "id": "vzkwvtri-bbrr-rpoi-msls-mu8hftigx8",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "userId": 51,
    "lastLogin": "2025-07-21T16:56:46.211Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-21T16:56:46.211Z"
  },
  {
    "id": "ni12qhw1-ou9t-nuhz-g3ud-p12plzp102d",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "lastLogin": "2025-07-21T16:56:46.211Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-21T16:56:46.211Z",
    "userId": 10
  },
  {
    "id": "5k8qlicw-nkyi-y3ik-je1d-tn6mgr8btpk",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "userId": 12,
    "lastLogin": "2025-07-21T16:56:46.211Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-21T16:56:46.211Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "slv659jb-oav5-76zm-bly1-6hsneoys80i",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "etdtt8oa-3ys7-0snh-kacb-f9vsz3thc1",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "dtung3v3-rw79-35ai-d17m-vf4uq8i66k",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 98,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "v2pgub69-hh2j-6hta-h4m9-nsoifmbhg6l",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 46,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "wqn13c6k-wsg1-v0o0-42iu-j5lcurhrj6f",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 44,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 56,
    "level": "level_1",
    "message": "message_1",
    "createdAt": "2025-07-21T16:56:46.211Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "ax8wjl6q-17vc-arh5-v8co-1vic7e06y8i",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 64,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 16,
    "createdAt": "2025-07-21T16:56:46.211Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "9jk111c9-waax-6dzm-cj3o-ld77c7ulshs",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "lsnsh09g-oo5u-vmpb-w3rm-x1rdw6xvmgl",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "completedAt": "2025-07-21T16:56:46.211Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "7bv6jyv3-gtnq-kbac-n7dw-akavli0u5r",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
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
    "id": "ly9uxw1p-nt0g-krl1-65kq-nr0b4yp76d",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": true,
    "defaultComponent": "defaultComponent_1"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "rfbvb89p-fkfu-boq4-8p7q-mpub0vuwkl8",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
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

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "k2ukpdfx-rcmw-5oi8-ne3d-dgpmvpyzfxw",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.2,
    "defaultAgent": "defaultAgent_1",
    "color": "color_1",
    "modelId": "modelId_1",
    "reasoning": "low"
  },
  {
    "id": "5lvkewt6-x53y-f5h5-s9g3-d448pfmdmnu",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.98,
    "defaultAgent": "defaultAgent_2",
    "color": "color_2",
    "reasoning": "medium"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "751hvjwf-n67b-ytg6-4kwu-9q0wk0eer5a",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.09,
    "modelId": "modelId_1",
    "reasoning": "low"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "6dvuvlfg-zmob-jh5p-76of-fqh4ln9ybon",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "crowdedness": 17,
    "timeId": "timeId_1",
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": false,
    "parentId": "parentId_1",
    "active": true
  },
  {
    "id": "pa7be49j-5min-sm7x-yev4-z84ilxfus3",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "crowdedness": 2,
    "classId": "classId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false,
    "parentId": "parentId_2",
    "active": false
  }
];

// SCENARIOCLASSES MOCK DATA
export const scenarioClasses = [
  {
    "id": "2hlh39kp-p0ci-loth-g25y-c96t1q5yuo6",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "name": "Scenario_classes 1",
    "classCode": "classCode_1",
    "description": "Description for scenario_classes 1"
  }
];

// SCENARIOLOCATIONS MOCK DATA
export const scenarioLocations = [
  {
    "id": "tqrz6enz-ypkp-bwla-ng90-pdp8fqtuh3t",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "name": "Scenario_locations 1",
    "description": "Description for scenario_locations 1"
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "a1rdgncq-fuge-cj4t-ell5-1ascu1mf99l",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "deadline": "deadline_1",
    "description": "Description for scenario_deadlines 1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "f24efug3-4iud-362w-xy3g-ks3def2tluf",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "timeOfDay": "timeOfDay_1",
    "description": "Description for scenario_times 1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "6nx05jic-knpn-e41e-1zch-ubgrdhdf2nl",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "title": "Math Practice Simulation",
    "active": true,
    "scenarioIds": [
      "6dvuvlfg-zmob-jh5p-76of-fqh4ln9ybon",
      "pa7be49j-5min-sm7x-yev4-z84ilxfus3"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "d23ddzlf-5x0z-7hs1-hm7f-txq9o57imwl",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "6dvuvlfg-zmob-jh5p-76of-fqh4ln9ybon",
      "pa7be49j-5min-sm7x-yev4-z84ilxfus3"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "k92enp3e-q28i-b79e-wjc1-dwhk4v3ssgs",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "psypp468-0kq3-na4o-q5f7-hf1en3rwur",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "completedAt": "2025-07-21T16:56:46.211Z",
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
    "id": "tn1h7fog-lkzl-6xaf-t07r-rq2iyb8jjq",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "91p76nbx-ywzp-kke9-qbbm-idb5zn3ozn",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "passed": true,
    "score": 37,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "g5in4eij-zoey-2o7b-8zxi-o66v08rlnt",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 88,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "17irshtg-peta-1ey7-q09v-nu1unqztct",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "moydpjrs-5lg0-1nfj-wzds-aig64h0tpig",
      "vzkwvtri-bbrr-rpoi-msls-mu8hftigx8",
      "ni12qhw1-ou9t-nuhz-g3ud-p12plzp102d",
      "5k8qlicw-nkyi-y3ik-je1d-tn6mgr8btpk"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "6nx05jic-knpn-e41e-1zch-ubgrdhdf2nl",
      "d23ddzlf-5x0z-7hs1-hm7f-txq9o57imwl"
    ]
  },
  {
    "id": "mx0nx4ge-4hdw-bnkq-agl9-7l2j6uifsm7",
    "createdAt": "2025-07-21T16:56:46.211Z",
    "updatedAt": "2025-07-21T16:56:46.211Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "moydpjrs-5lg0-1nfj-wzds-aig64h0tpig",
      "vzkwvtri-bbrr-rpoi-msls-mu8hftigx8",
      "ni12qhw1-ou9t-nuhz-g3ud-p12plzp102d",
      "5k8qlicw-nkyi-y3ik-je1d-tn6mgr8btpk"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "6nx05jic-knpn-e41e-1zch-ubgrdhdf2nl",
      "d23ddzlf-5x0z-7hs1-hm7f-txq9o57imwl"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-21T16:56:46.211Z",
    "token": "token_1"
  }
];

