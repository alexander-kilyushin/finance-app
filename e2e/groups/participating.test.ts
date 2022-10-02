import { ITestUserUsername, authorize } from "../helpers/authorize"
import { fetchApi } from "../helpers/fetchApi"

describe("Participating in a group", () => {
  test.each<{
    authorizedUserUsername: ITestUserUsername
    responseBody: Record<string, unknown>
    status: number
    url: string
  }>([
    {
      authorizedUserUsername: "jessica-stark",
      responseBody: { message: "You are already a member of this group." },
      status: 400,
      url: "/api/groups/2/participating",
    },
    {
      authorizedUserUsername: "john-doe",
      responseBody: {
        admins: [{ id: 2, username: "jessica-stark", password: "8bd912e2fe84cd93c457142a1d7e77136c3bc954f183" }],
        id: 3,
        members: [
          { id: 2, username: "jessica-stark", password: "8bd912e2fe84cd93c457142a1d7e77136c3bc954f183" },
          { id: 1, username: "john-doe", password: "8bd309ffba83c3db9a53142b052468007b" },
        ],
        name: "beautiful-sportsmen",
        subject: { id: 2, name: "habits" },
      },
      status: 201,
      url: "/api/groups/3/participating",
    },
  ])("Group joining case #%#", async ({ authorizedUserUsername, responseBody, status, url }) => {
    await authorize(authorizedUserUsername)
    const response = await fetchApi(url, { method: "POST" })
    expect(response.status).toEqual(status)
    expect(await response.json()).toEqual(responseBody)
  })

  test.each<{
    authorizedUserUsername: ITestUserUsername
    responseBody: Record<string, unknown>
    status: number
    url: string
  }>([
    {
      authorizedUserUsername: "john-doe",
      responseBody: { message: "You can't leave this group because you are not it's member." },
      status: 400,
      url: "/api/groups/3/participating",
    },
    {
      authorizedUserUsername: "jessica-stark",
      responseBody: {
        message: "You can't leave a group where you are the only admin. You can delete the group.",
      },
      status: 400,
      url: "/api/groups/3/participating",
    },
    {
      authorizedUserUsername: "jessica-stark",
      responseBody: {
        admins: [{ id: 1, username: "john-doe", password: "8bd309ffba83c3db9a53142b052468007b" }],
        id: 1,
        members: [{ id: 1, username: "john-doe", password: "8bd309ffba83c3db9a53142b052468007b" }],
        name: "clever-financiers",
        subject: { id: 1, name: "finances" },
      },
      status: 200,
      url: "/api/groups/1/participating",
    },
  ])("Group leaving case #%#", async ({ authorizedUserUsername, responseBody, status, url }) => {
    await authorize(authorizedUserUsername)
    const response = await fetchApi(url, { method: "DELETE" })
    expect(response.status).toEqual(status)
    expect(await response.json()).toEqual(responseBody)
  })
})
