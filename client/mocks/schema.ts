// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 96,
    "userId": 44,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 10,
    "idToken": "idToken_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 24,
    "userId": 17,
    "expires": "2025-07-20T16:34:46.036Z",
    "sessionToken": "sessionToken_1"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 82,
    "name": "Admin User",
    "emailVerified": "2025-07-20T16:34:46.036Z",
    "image": "image_1"
  },
  {
    "id": 78,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-20T16:34:46.036Z",
    "image": "image_2"
  },
  {
    "id": 71,
    "email": "instructor@example.com",
    "emailVerified": "2025-07-20T16:34:46.036Z",
    "image": "image_3"
  },
  {
    "id": 8,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-07-20T16:34:46.036Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "ax9ez8wn-vme9-5i73-c2j9-cuxapb0b2bs",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "userId": 82,
    "lastLogin": "2025-07-20T16:34:46.036Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-20T16:34:46.036Z"
  },
  {
    "id": "zwumzm4k-3rwy-x4tz-v97r-g07eic2eygk",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "lastLogin": "2025-07-20T16:34:46.036Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-20T16:34:46.036Z",
    "userId": 78
  },
  {
    "id": "tzjntstw-xi62-9gwt-ibf1-2zv012bxtbl",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "userId": 71,
    "lastLogin": "2025-07-20T16:34:46.036Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-20T16:34:46.036Z"
  },
  {
    "id": "v5hyl78x-onm1-ejh4-1ly4-8a1z55myr2g",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "lastLogin": "2025-07-20T16:34:46.036Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-20T16:34:46.036Z",
    "userId": 8
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "kg0hcn7y-zgq7-qcph-ca8f-lb8cs4wgomr",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// DEPARTMENTS MOCK DATA
export const departments = [
  {
    "id": "fe30l0a7-ag7v-t60v-6nzn-vzrlz1b7ecl",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "departmentCode": "departmentCode_1",
    "name": "Departments 1",
    "description": "Description for departments 1",
    "profileIds": [
      "ax9ez8wn-vme9-5i73-c2j9-cuxapb0b2bs",
      "zwumzm4k-3rwy-x4tz-v97r-g07eic2eygk",
      "tzjntstw-xi62-9gwt-ibf1-2zv012bxtbl",
      "v5hyl78x-onm1-ejh4-1ly4-8a1z55myr2g"
    ]
  }
];

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "36leod4j-cblu-5eqc-c727-xmugnihfxzf",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "departmentId": "departmentId_1",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1",
    "profileIds": [
      "ax9ez8wn-vme9-5i73-c2j9-cuxapb0b2bs",
      "zwumzm4k-3rwy-x4tz-v97r-g07eic2eygk",
      "tzjntstw-xi62-9gwt-ibf1-2zv012bxtbl",
      "v5hyl78x-onm1-ejh4-1ly4-8a1z55myr2g"
    ]
  },
  {
    "id": "3m9bxfm5-c1yt-9zoc-3rwr-a84cb4jd3wo",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "departmentId": "departmentId_2",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2",
    "profileIds": [
      "ax9ez8wn-vme9-5i73-c2j9-cuxapb0b2bs",
      "zwumzm4k-3rwy-x4tz-v97r-g07eic2eygk",
      "tzjntstw-xi62-9gwt-ibf1-2zv012bxtbl",
      "v5hyl78x-onm1-ejh4-1ly4-8a1z55myr2g"
    ]
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "53tfzfev-c5ge-qcd6-0894-7kam4sehedq",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// LOCATIONS MOCK DATA
export const locations = [
  {
    "id": "t3ghw87h-130w-20ng-vy23-783xzdzwcel",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "name": "Locations 1",
    "description": "Description for locations 1",
    "departmentId": "departmentId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "j5621ngb-aahp-fq2c-6x6b-x9nkzhp0wc",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": true,
    "fileId": "fileId_1"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "xmznfiek-kwqm-xwn4-3ugd-o6h8nkymbv",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 97,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "oxdv49rt-e80t-j2c4-f19c-jqbnz5x7cki",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 97,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "t89anmxe-cwmy-9131-uli5-6s60u72tj4x",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 33,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "qb9et4oo-49ta-p6bo-y2gh-rx0myvtkk5r",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 90,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 37,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-20T16:34:46.036Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 75,
    "createdAt": "2025-07-20T16:34:46.036Z",
    "type": "feature"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "jqf4klu4-q7al-xkk4-3416-h0l85jau7qh",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "glw8lee5-27v2-g0p4-af2v-drcfbwcd2mf",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "completedAt": "2025-07-20T16:34:46.036Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "xiypdcip-kbwv-misi-tir2-whysagv9rgg",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
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
    "id": "h1a63744-gc19-kqbo-y0ug-mrpsyezkfdk",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
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
    "id": "hwtum4yy-ii1s-afcm-75nh-dojvzx99bvt",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
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
    "id": "legf1nxs-b43m-b8yv-82kb-nwymv52o7vr",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.04,
    "defaultAgent": "defaultAgent_1",
    "color": "color_1",
    "modelId": "modelId_1",
    "reasoning": "low"
  },
  {
    "id": "p0v6as2s-0t2r-rbdm-x5cm-n8c002qlk6p",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.95,
    "defaultAgent": "defaultAgent_2",
    "color": "color_2",
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "30kqrcvn-kxjq-500x-ktuq-4oqgd1jvp2a",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.9,
    "modelId": "modelId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "c2jjey04-71vl-f35o-ahmr-2tu7pblz25n",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
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
    "parentId": "parentId_1"
  },
  {
    "id": "8eppm76k-bce4-kdw1-q9py-13rmkc8pxq6",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "classId": "classId_2",
    "crowdedness": 17,
    "intensity": 36,
    "locationId": "locationId_2",
    "timeId": "timeId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": true,
    "parentId": "parentId_2"
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "j81kwsdp-4tc1-c4e2-gev6-eb0auw0cy2p",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "deadline": "deadline_1",
    "description": "Description for scenario_deadlines 1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "kabk15g8-jaz7-wl3h-0bdp-rkghj35by5f",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "timeOfDay": "timeOfDay_1",
    "description": "Description for scenario_times 1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "vjtpp4wd-gba8-mvdr-dzln-wlqsq3vaqz9",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "ax9ez8wn-vme9-5i73-c2j9-cuxapb0b2bs",
      "zwumzm4k-3rwy-x4tz-v97r-g07eic2eygk",
      "tzjntstw-xi62-9gwt-ibf1-2zv012bxtbl",
      "v5hyl78x-onm1-ejh4-1ly4-8a1z55myr2g"
    ],
    "defaultCohort": "defaultCohort_1",
    "departmentId": "departmentId_1"
  },
  {
    "id": "f0hc3fxa-duja-ckdu-03i3-pl2n5652wc",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "ax9ez8wn-vme9-5i73-c2j9-cuxapb0b2bs",
      "zwumzm4k-3rwy-x4tz-v97r-g07eic2eygk",
      "tzjntstw-xi62-9gwt-ibf1-2zv012bxtbl",
      "v5hyl78x-onm1-ejh4-1ly4-8a1z55myr2g"
    ],
    "defaultCohort": "defaultCohort_2",
    "departmentId": "departmentId_2"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "klksts3a-8gm2-1hux-7vw2-edmzwvswrgb",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "c2jjey04-71vl-f35o-ahmr-2tu7pblz25n",
      "8eppm76k-bce4-kdw1-q9py-13rmkc8pxq6"
    ],
    "cohortIds": [
      "vjtpp4wd-gba8-mvdr-dzln-wlqsq3vaqz9",
      "f0hc3fxa-duja-ckdu-03i3-pl2n5652wc"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "49ims2xs-fjqg-oa6g-kpun-5rwr4ir8y7d",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "c2jjey04-71vl-f35o-ahmr-2tu7pblz25n",
      "8eppm76k-bce4-kdw1-q9py-13rmkc8pxq6"
    ],
    "cohortIds": [
      "vjtpp4wd-gba8-mvdr-dzln-wlqsq3vaqz9",
      "f0hc3fxa-duja-ckdu-03i3-pl2n5652wc"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "1gx3slli-kzj2-b5qd-grp2-gh5uwik686",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "przhgmes-swds-zlw4-a7kv-yhtypp0k93q",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "completedAt": "2025-07-20T16:34:46.036Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "9hr4yvkh-ygb2-ar6e-n1e4-4c8y6jeqn9u",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "updatedAt": "2025-07-20T16:34:46.036Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "gl9ycjxu-juqe-eqvt-2jq7-kjzn8vkrlv",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "passed": true,
    "score": 24,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "4lizoksj-2hyw-q7ec-9ymj-blybgxapawl",
    "createdAt": "2025-07-20T16:34:46.036Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 73,
    "feedback": "feedback_1"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-20T16:34:46.036Z",
    "token": "token_1"
  }
];

