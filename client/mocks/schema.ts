// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 47,
    "userId": 30,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 66,
    "idToken": "idToken_1",
    "sessionState": "sessionState_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 52,
    "userId": 66,
    "expires": "2025-07-24T00:38:21.856Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "brmbb5f8-qr0z-t7vd-lutu-tss7mgpv7m9",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
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
    "id": 53,
    "emailVerified": "2025-07-24T00:38:21.856Z",
    "image": "image_1"
  },
  {
    "id": 67,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-24T00:38:21.856Z"
  },
  {
    "id": 34,
    "name": "Instructor User"
  },
  {
    "id": 55,
    "email": "ta@example.com",
    "emailVerified": "2025-07-24T00:38:21.856Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "x790j1j2-c70l-95eh-z7ir-e2eiljkn7y4",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "lastLogin": "2025-07-24T00:38:21.856Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-24T00:38:21.856Z",
    "userId": 53
  },
  {
    "id": "46n6q3i6-el0x-szvi-s1ci-cfajvu4uaq",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "lastLogin": "2025-07-24T00:38:21.856Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-24T00:38:21.856Z",
    "userId": 67
  },
  {
    "id": "x5euxvzh-h0zt-b2rb-346n-inyv09jrtui",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "lastLogin": "2025-07-24T00:38:21.856Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-24T00:38:21.856Z",
    "userId": 34
  },
  {
    "id": "m1i2a6xt-h3gv-uf4r-u3pp-5l8bz874uuv",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "lastLogin": "2025-07-24T00:38:21.856Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-24T00:38:21.856Z",
    "userId": 55
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "l7n49nu0-3it4-smep-ymrk-2huodgw1b95",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "zcstacds-ejz9-bol5-hpia-e9t7pml6w6r",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "4kuz83o4-a87o-a9nk-3ila-zs2t5muyelk",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 53,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "k9iyr3p3-o1ff-27ia-iuly-uc448xi05i8",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 69,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "ed15k8a4-e3kj-4jky-cv3g-zhpkyz6z39i",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 2,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 95,
    "level": "level_1",
    "context": {},
    "createdAt": "2025-07-24T00:38:21.856Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "ro9fvb7k-m8nz-k1gi-82hs-qabf2haek5",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 70,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 35,
    "createdAt": "2025-07-24T00:38:21.856Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "lw78dj2b-es41-qg7q-vzz0-nwgnyeh68rk",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "ervr5flx-1ny9-lqj0-qvyr-qn1lzd30x8m",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "completedAt": "2025-07-24T00:38:21.856Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "kbqrtxnd-nd8x-s7pl-gy16-kkuiqtr79fi",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "completedAt": "2025-07-24T00:38:21.856Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": false
  }
];

// PERSONAS MOCK DATA
export const personas = [
  {
    "id": "6771g9xo-u3iw-ogj7-1hl2-s9kii466zf",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.87,
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "modelId": "modelId_1"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "t6wzz6d3-lsv0-xgg2-ubt6-fmlcmhyycrg",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.03,
    "modelId": "modelId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "xgf9m5hb-dwm3-lac4-fjl8-lkjqz87sjqb",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "crowdedness": 52,
    "intensity": 54,
    "classId": "classId_1",
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
    "id": "d17adiig-ftb1-mv4z-yzb9-8vk3zj7wjec",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "personaId": "personaId_2",
    "crowdedness": 95,
    "classId": "classId_2",
    "locationId": "locationId_2",
    "documentIds": [
      "documentIds_2"
    ],
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
    "id": "hgr9f7ww-bayj-x4ed-oaac-hfj04f65mp",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "name": "Scenario_classes 1",
    "classCode": "classCode_1",
    "description": "Description for scenario_classes 1"
  }
];

// SCENARIOLOCATIONS MOCK DATA
export const scenarioLocations = [
  {
    "id": "6akr6u26-g6vd-7lhs-5dq1-ko79q1vazzp",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "name": "Scenario_locations 1",
    "description": "Description for scenario_locations 1"
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "j0h05h2i-sbl0-2a2q-9pop-zfp99kj7ilk",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "deadline": "deadline_1",
    "description": "Description for scenario_deadlines 1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "2r5w3395-uyac-fdlc-ikyl-vgbwrxrdbvt",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "timeOfDay": "timeOfDay_1",
    "description": "Description for scenario_times 1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "buxe9j1l-7l8v-6t2d-m266-t52ibz8tdeq",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "xgf9m5hb-dwm3-lac4-fjl8-lkjqz87sjqb",
      "d17adiig-ftb1-mv4z-yzb9-8vk3zj7wjec"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "6pspy0hu-83rj-372t-7io5-jjpk5xjj4z",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "title": "Lab Safety Training",
    "active": false,
    "scenarioIds": [
      "xgf9m5hb-dwm3-lac4-fjl8-lkjqz87sjqb",
      "d17adiig-ftb1-mv4z-yzb9-8vk3zj7wjec"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "2vwaqgtg-dcqu-q7lv-4zru-1hk8lwpt9i7j",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "z1vywc9u-8j28-mfso-s9go-vzfhma8tlbc",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "completedAt": "2025-07-24T00:38:21.856Z",
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
    "id": "t556pdev-nyje-d9ed-3ks8-giuq5jgwe0o",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "idjcesy9-zmmk-sv7f-2oz8-jd59pgnkky",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "passed": false,
    "score": 81,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "2airze6r-xmpw-khq7-43bk-amuul6gwomd",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 53,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "3xrhjwjb-58h6-b2b6-8kwy-ayqcn0y349",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "x790j1j2-c70l-95eh-z7ir-e2eiljkn7y4",
      "46n6q3i6-el0x-szvi-s1ci-cfajvu4uaq",
      "x5euxvzh-h0zt-b2rb-346n-inyv09jrtui",
      "m1i2a6xt-h3gv-uf4r-u3pp-5l8bz874uuv"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "buxe9j1l-7l8v-6t2d-m266-t52ibz8tdeq",
      "6pspy0hu-83rj-372t-7io5-jjpk5xjj4z"
    ]
  },
  {
    "id": "rosybmsl-7ybs-r9z9-ekby-3se74a2zibq",
    "createdAt": "2025-07-24T00:38:21.856Z",
    "updatedAt": "2025-07-24T00:38:21.856Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "x790j1j2-c70l-95eh-z7ir-e2eiljkn7y4",
      "46n6q3i6-el0x-szvi-s1ci-cfajvu4uaq",
      "x5euxvzh-h0zt-b2rb-346n-inyv09jrtui",
      "m1i2a6xt-h3gv-uf4r-u3pp-5l8bz874uuv"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "buxe9j1l-7l8v-6t2d-m266-t52ibz8tdeq",
      "6pspy0hu-83rj-372t-7io5-jjpk5xjj4z"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-24T00:38:21.856Z",
    "token": "token_1"
  }
];

