import { useState, useEffect } from "react"
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd"
import { supabase } from "./supabaseClient"
import logo from "./nextplaylogo.png"

const columns = ["todo", "in_progress", "in_review", "done"]

function App() {
  //States
  const [tasks, setTasks] = useState([])
  const [user, setUser] = useState(null)
  const [team, setTeam] = useState([])
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [search, setSearch] = useState("")
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [activeDetailTask, setActiveDetailTask] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState("")
  const [activity, setActivity] = useState([])
  const [activeLabelFilter, setActiveLabelFilter] = useState(null)
  const flags = [
  { name: "bug", color: "#ef4444" },      
  { name: "feature", color: "#22c55e" },
  { name: "design", color: "#a855f7" }, 
]
  const [activeFlagTaskId, setActiveFlagTaskId] = useState(null)
  const [editDueDate, setEditDueDate] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [filterAssignee, setFilterAssignee] = useState("all")
  const [filterFlag, setFilterFlag] = useState("all")
  const [sortBy, setSortBy] = useState("none")
  const [view, setView] = useState("board")

  const totalTasks = tasks.length

  const completedTasks = tasks.filter(t => t.status === "done").length

  const overdueTasks = tasks.filter(t => {
    if (!t.due_date) return false
    return new Date(t.due_date) < new Date() && t.status !== "done"
  }).length
  // Auth
  useEffect(() => {
    const initUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession()

      if (sessionData.session?.user) {
        setUser(sessionData.session.user)
      } else {
        const { data } = await supabase.auth.signInAnonymously()
        setUser(data.user)
      }
    }

    initUser()
  }, [])

  // 📦 Fetch data
  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const { data: taskData } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)

      const { data: teamData } = await supabase
        .from("team_members")
        .select("*")
        .eq("user_id", user.id)

      if (taskData) setTasks(taskData)
      if (teamData) setTeam(teamData)
      console.log("TEAM DATA:", teamData)
    }

    fetchData()
  }, [user])
  useEffect(() => {
  if (!activeDetailTask) return

  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("task_id", activeDetailTask.id)
      .order("created_at", { ascending: true })

    if (data) setComments(data)
  }

  fetchComments()
}, [activeDetailTask])

//calc progress
const percentDone = totalTasks
  ? Math.round((completedTasks / totalTasks) * 100)
  : 0

  // Add task
const addTask = async () => {
    try {
      if (!user) {
        console.warn("User not ready yet")
        return
      }

      const { data, error } = await supabase
        .from("tasks")
        .insert([
          {
            title: "New Task",
            description: "",
            status: "todo",
            user_id: user.id,
            assignees: [],
          },
        ])
        .select()

      if (error) {
        console.error("Error creating task:", error)
        return
      }

      if (!data || data.length === 0) return

      const newTask = data[0]

      setTasks((prev) => [...prev, newTask])

      await supabase.from("activity").insert([
        {
          task_id: newTask.id,
          user_id: user.id,
          action: "Created task",
        },
      ])

    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

const addMember = async () => {
  console.log("Add Member clicked")

  if (!user) {
    console.log("User NOT ready")
    return
  }

  const name = prompt("Enter member name")
  if (!name) return

  const color =
    "#" + Math.floor(Math.random() * 16777215).toString(16)

  const { data, error } = await supabase
    .from("team_members")
    .insert([{ name, color, user_id: user.id }])
    .select()

  console.log("DATA:", data)
  console.log("ERROR:", error)

  if (data) setTeam(prev => [...prev, ...data])
}

  // Drag
  const handleDragEnd = async (result) => {
  console.log("🔥 DRAG FIRED")

  if (!result.destination) {
    console.log("❌ NO DESTINATION")
    return
  }

  const { draggableId, destination } = result

  console.log("Dragging:", draggableId, "→", destination.droppableId)

  try {
    // update DB
    await supabase
      .from("tasks")
      .update({ status: destination.droppableId })
      .eq("id", draggableId)

    console.log(" DB UPDATED")

    // update UI
    setTasks((prev) =>
      prev.map((task) =>
        task.id === draggableId
          ? { ...task, status: destination.droppableId }
          : task
      )
    )

    // 🔥 FORCE CALL
    console.log("👉 CALLING LOG ACTIVITY")
    await logActivity(
      String(draggableId),
      `Moved to ${destination.droppableId}`
    )

  } catch (err) {
    console.error("❌ DRAG ERROR:", err)
  }
}
  // ActivityDetail
  useEffect(() => {
    if (!activeDetailTask) return

    const fetchData = async () => {
      const { data: commentData } = await supabase
        .from("comments")
        .select("*")
        .eq("task_id", activeDetailTask.id)
        .order("created_at", { ascending: true })

      const { data: activityData } = await supabase
        .from("activity")
        .select("*")
        .eq("task_id", activeDetailTask.id)
        .order("created_at", { ascending: false })

      if (commentData) setComments(commentData)
      if (activityData) setActivity(activityData)
    }

    fetchData()
  }, [activeDetailTask])

  const logActivity = async (taskId, actionText) => {
    console.log("LOG ACTIVITY CALLED")
      if (!user) return

      const { error } = await supabase
        .from("activity")
        .insert([
          {
            task_id: taskId,
            user_id: user.id,
            action: actionText,
          },
        ])

      if (error) {
        console.error("Activity insert error:", error)
        return
      }

      const { data: activityData } = await supabase
        .from("activity")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })

      if (activityData) setActivity(activityData)
    }

  // Assign member to task
  const assignMember = async (task) => {
    if (!team.length) return

    const member = team[0] // simple for now

    const updated = [...(task.assignees || []), member.id]

    await supabase
      .from("tasks")
      .update({ assignees: updated })
      .eq("id", String(task.id))

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, assignees: updated } : t
      )
    )
  }

  const addComment = async () => {
  if (!newComment || !user) return

  const { data } = await supabase
    .from("comments")
    .insert([
      {
        task_id: activeDetailTask.id,
        user_id: user.id,
        content: newComment,
      },
    ])
    .select()

  if (data) {
    setComments((prev) => [...prev, ...data])
    setNewComment("")
  }
  }

  const CalendarView = ({ tasks }) => {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  // get first day of month
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // group tasks by date
  const tasksByDate = {}
  tasks.forEach(task => {
    if (!task.due_date) return
    const date = new Date(task.due_date).getDate()
    if (!tasksByDate[date]) tasksByDate[date] = []
    tasksByDate[date].push(task)
  })

  const days = []

  // empty slots before first day
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={"empty-" + i}></div>)
  }

  // actual days
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate()
    days.push(
      <div
        key={d}
        style={{
          border: isToday
            ? "2px solid #3b82f6"
            : "1px solid rgba(255,255,255,0.2)",

          borderRadius: "10px",
          padding: "8px",
          minHeight: "100px",

          background: isToday
          ? "#dbeafe"   
          : "#ffffff",  

          boxShadow: isToday
          ? "0 0 12px rgba(59,130,246,0.5)"
          : "0 2px 6px rgba(0,0,0,0.1)",
          
          border: isToday
          ? "2px solid #3b82f6"
          : "1px solid #e5e7eb",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
          {d}
        </div>

        {(tasksByDate[d] || []).map(task => (
          <div
            key={task.id}
            style={{
              fontSize: "11px",
              background: "#f1f5f9",
              padding: "4px",
              borderRadius: "6px",
              marginBottom: "4px",
            }}
          >
            {task.title}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: "10px",
      }}
    >
      {days}
    </div>
  )
}

  //Styles
  const statCard = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
    padding: "10px",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.2)",
    fontWeight: "500",
  }

  const columnColors = {
    todo: "#e0f2fe",
    in_progress: "#fef3c7",
    in_review: "#ede9fe",
    done: "#dcfce7",
  }
  const selectStyle = {
  padding: "8px 10px",
  borderRadius: "8px",
  border: "none",
  background: "white",
  cursor: "pointer",
}

const primaryBtn = {
  padding: "10px 16px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #3b82f6, #2563eb)",
  color: "white",
  fontWeight: "600",
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
}

const secondaryBtn = {
  padding: "10px 16px",
  borderRadius: "10px",
  border: "none",
  background: "rgba(255,255,255,0.8)",
  fontWeight: "600",
  cursor: "pointer",
}

  return (
    <>
    <div
    style={{
      display: "flex",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1e40af, #3b82f6, #93c5fd)",
    }}
  >
    {/* LEFT SIDEBAR */}
<div
  style={{
    width: "260px",
    minHeight: "100vh",
    position: "sticky",
    top: "0",

    display: "flex",
    flexDirection: "column",

    background: "linear-gradient(180deg, #1e3a8a, #1e40af)",
    color: "white",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
    borderRadius: "12px",
    padding: "16px",
  }}
>
  <h3 style={{ textAlign: "center", marginBottom: "12px" }}>
    Board Stats
  </h3>

  {/* TOTAL */}
  <div style={statCard}>
  <div style={{ fontSize: "13px", opacity: 0.8 }}>
    Total Tasks
  </div>
  <div style={{ fontSize: "20px", fontWeight: "700" }}>
    {totalTasks}
  </div>
</div>

  {/* COMPLETED */}
  <div style={statCard}>
    <div style={{ fontSize: "13px", opacity: 0.8 }}>
    Completed
  </div>
  <div style={{ fontSize: "20px", fontWeight: "700" }}>
    {completedTasks}
  </div>
</div>

  {/* OVERDUE */}
  <div style={statCard}>
    <div style={{ fontSize: "13px", opacity: 0.8 }}>
    Overdue
  </div>
    <strong style={{ color: "#ef4444" }}>{overdueTasks}</strong>
  </div>
  <div style={statCard}>
    <span style={{ fontSize: "13px", opacity: 0.8 }}>Progress</span>
    <strong>{percentDone}%</strong>
  </div>
</div>
    <div style={{ flex: 1, padding: "20px" }}>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
          color: "white",
        }}
      >
        <img src={logo} alt="logo" style={{ width: "40px" }} />
        <h1 style={{ margin: 0 }}>Task Board</h1>
      </div>

     {/* CONTROLS */}
<div
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
  }}
>
  <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
  <button
    onClick={() => setView("board")}
    style={{
      padding: "8px 12px",
      borderRadius: "8px",
      border: "none",
      background: view === "board" ? "#2563eb" : "#e5e7eb",
      color: view === "board" ? "white" : "black",
      cursor: "pointer",
    }}
  >
    Board
  </button>

  <button
    onClick={() => setView("calendar")}
    style={{
      padding: "8px 12px",
      borderRadius: "8px",
      border: "none",
      background: view === "calendar" ? "#2563eb" : "#e5e7eb",
      color: view === "calendar" ? "white" : "black",
      cursor: "pointer",
    }}
  >
    Calendar
  </button>
</div>

  {/* 🔍 SEARCH + FILTERS */}
  <div
    style={{
      display: "flex",
      gap: "10px",
      alignItems: "center",
      background: "rgba(255,255,255,0.15)",
      padding: "10px",
      borderRadius: "12px",
      backdropFilter: "blur(6px)",
    }}
  >
    {/* SEARCH INPUT */}
    <input
      type="text"
      placeholder="Search tasks..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      style={{
        padding: "10px 14px",
        borderRadius: "10px",
        border: "none",
        outline: "none",
        width: "220px",
        fontSize: "14px",
        background: "rgba(255,255,255,0.9)",
      }}
    />

    {/* ASSIGNEE */}
    <select
      value={filterAssignee}
      onChange={(e) => setFilterAssignee(e.target.value)}
      style={selectStyle}
    >
      <option value="all">All Members</option>
      {team.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>

    {/* FLAG */}
    <select
      value={filterFlag}
      onChange={(e) => setFilterFlag(e.target.value)}
      style={selectStyle}
    >
      <option value="all">All Flags</option>
      {flags.map((f) => (
        <option key={f.name} value={f.name}>
          {f.name}
        </option>
      ))}
    </select>

    {/* SORT */}
    <select
      value={sortBy}
      onChange={(e) => setSortBy(e.target.value)}
      style={selectStyle}
    >
      <option value="none">Sort</option>
      <option value="due">Due Date</option>
      <option value="title">Title</option>
      <option value="flag">Flag</option>
    </select>

    {/* ❌ CLEAR BUTTON */}
    <button
      onClick={() => {
        setSearchQuery("")
        setFilterAssignee("all")
        setFilterFlag("all")
        setSortBy("none")
      }}
      style={{
        padding: "8px 12px",
        borderRadius: "8px",
        border: "none",
        cursor: "pointer",
        background: "#ef4444",
        color: "white",
        fontWeight: "bold",
      }}
    >
      Clear
    </button>
  </div>

  {/* ➕ ACTION BUTTONS */}
  <div style={{ display: "flex", gap: "12px" }}>
    <button style={primaryBtn} onClick={addTask}>
      + Add Task
    </button>

    <button style={secondaryBtn} onClick={addMember}>
      + Add Member
    </button>
  </div>

</div>
      {/* TEAM DISPLAY */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
      </div>
      {/* BOARD */}
      {view === "board" ? (
      <DragDropContext onDragEnd={handleDragEnd}>
  {/* LEFT: TASK COLUMNS */}
  <div
    style={{
      display: "flex",
      gap: "20px",
      flex: 1,            // takes remaining space
    }}
  >


  {/* LEFT: TASK BOARD */}
    {columns.map((col) => (
      <Droppable key={col} droppableId={col}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              width: "250px",
              minHeight: "400px",
              background: columnColors[col],
              borderRadius: "12px",
              padding: "12px",
            }}
          >
            <h3 style={{ textAlign: "center" }}>{col}</h3>
                  {/*Task Cards*/}

                  {tasks
                  .filter((task) => task.status === col)
                  //  SEARCH (title)
                  .filter((task) =>
                    task.title.toLowerCase().includes(searchQuery.toLowerCase())
                  )

                  //  ASSIGNEE FILTER
                  .filter((task) =>
                    filterAssignee === "all"
                      ? true
                      : task.assignees?.includes(filterAssignee)
                  )

                  //  FLAG FILTER
                  .filter((task) =>
                    filterFlag === "all"
                      ? true
                      : task.flag === filterFlag
                  )

                  //  SORT
                  .sort((a, b) => {
                    if (sortBy === "due") {
                      return new Date(a.due_date || 0) - new Date(b.due_date || 0)
                    }
                    if (sortBy === "title") {
                      return a.title.localeCompare(b.title)
                    }
                    if (sortBy === "flag") {
                      return (a.flag || "").localeCompare(b.flag || "")
                    }
                    return 0
                  })

                  .map((task, index) => {

                    const isDueSoon = (dueDate) => {
                      if (!dueDate) return false
                      const now = new Date()
                      const due = new Date(dueDate)
                      const diff = (due - now) / (1000 * 60 * 60)
                      return diff <= 24 && diff > 0
                    }

                    const isOverdue = (dueDate) => {
                      if (!dueDate) return false
                      return new Date(dueDate) < new Date()
                    }
                    return(
                    <Draggable
                      key={task.id}
                      draggableId={task.id}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{
                            background:
                              flags.find(f => f.name === task.flag)?.color
                                ? flags.find(f => f.name === task.flag).color + "20"
                                : "white",
                            borderLeft: flags.find(f => f.name === task.flag)
                              ? `4px solid ${flags.find(f => f.name === task.flag).color}`
                              : "none",
                            padding: "12px",
                            marginBottom: "12px",
                            borderRadius: "10px",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                            ...provided.draggableProps.style,
                          }}
                        >
                          {/* ✏️ EDIT MODE */}
                          {editingTaskId === task.id ? (
                            <div>
                              <input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                style={{
                                  width: "100%",
                                  marginBottom: "6px",
                                  padding: "6px",
                                  borderRadius: "6px",
                                  border: "1px solid #ccc",
                                }}
                              />

                              <input
                                type="datetime-local"
                                value={editDueDate}
                                onChange={(e) => setEditDueDate(e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "6px",
                                  borderRadius: "6px",
                                  border: "1px solid #ccc",
                                  marginBottom: "6px",
                                }}
                              />

                              <textarea
                                placeholder="Description..."
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "6px",
                                  borderRadius: "6px",
                                  border: "1px solid #ccc",
                                  marginBottom: "6px",
                                }}
                              />

                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  onClick={async () => {
                                      console.log("🔥 SAVE CLICKED")

                                      if (!editTitle.trim()) {
                                        console.log("❌ empty title")
                                        return
                                      }

                                      try {
                                        const { data, error } = await supabase
                                          .from("tasks")
                                          .update({
                                            title: editTitle,
                                            description: editDesc || "",
                                            due_date: editDueDate
                                              ? new Date(editDueDate).toISOString()
                                              : null,
                                          })
                                          .eq("id", String(task.id))
                                          .select()

                                        if (error) {
                                          console.error("❌ UPDATE FAILED:", error)
                                          return
                                        }

                                        if (!data || data.length === 0) return

                                        const updatedTask = data[0]

                                        setTasks((prev) =>
                                          prev.map((t) =>
                                            t.id === updatedTask.id ? updatedTask : t
                                          )
                                        )

                                        if (activeDetailTask?.id === updatedTask.id) {
                                          setActiveDetailTask(updatedTask)
                                        }

                                        await logActivity(updatedTask.id, "Edited task")

                                        setEditingTaskId(null)

                                        // 🔥 RESET INPUTS
                                        setEditTitle("")
                                        setEditDesc("")
                                        setEditDueDate("")

                                      } catch (err) {
                                        console.error("❌ SAVE CRASH:", err)
                                      }
                                    }}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: "6px",
                                    border: "none",
                                    background: "#2563eb",
                                    color: "white",
                                    cursor: "pointer",
                                  }}
                                >
                                  Save
                                </button>

                                <button
                                  onClick={() => setEditingTaskId(null)}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: "6px",
                                    border: "none",
                                    background: "#e5e7eb",
                                    cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* 🧠 HEADER (title + actions) */}
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <span
                                  onClick={() => setActiveDetailTask(task)}
                                  style={{ cursor: "pointer"}}
                                >{task.title}</span>

                                <div style={{ display: "flex", gap: "8px" }}>
                                  {/* 🚩 FLAG BUTTON */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setActiveFlagTaskId(task.id)
                                    }}
                                    style={{
                                      border: "none",
                                      background: "transparent",   
                                      padding: "0",               
                                      cursor: "pointer",
                                      fontSize: "16px",
                                    }}
                                    title="Set flag"
                                  >
                                    🚩
                                  </button>
                                  {/* 👤 ASSIGN BUTTON */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setActiveTaskId(task.id)
                                      setSearch("")
                                    }}
                                    style={{
                                      border: "none",
                                      background: "transparent",
                                      cursor: "pointer",
                                    }}
                                    title="Assign member"
                                  >
                                    👤
                                  </button>

                                  {/* ✏️ EDIT BUTTON */}
                                  <button
                                    onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingTaskId(task.id)
                                    setEditTitle(task.title)
                                    setEditDesc(task.description || "")
                                    setEditDueDate(
                                      task.due_date
                                        ? new Date(task.due_date).toISOString().slice(0, 16)
                                        : ""
                                    )
                                  }}
                                    style={{
                                      border: "none",
                                      background: "transparent",
                                      cursor: "pointer",
                                    }}
                                    title="Edit task"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation()

                                      setActiveDetailTask(task)

                                      // fetch comments when opened
                                      const { data } = await supabase
                                        .from("comments")
                                        .select("*")
                                        .eq("task_id", task.id)
                                        .order("created_at", { ascending: true })

                                      if (data) setComments(data)
                                    }}
                                    style={{
                                      border: "none",
                                      background: "transparent",
                                      cursor: "pointer",
                                    }}
                                    title="Comments"
                                  >
                                    💬
                                  </button>
                                </div>
                              </div>

                              {/* 📝 DESCRIPTION */}
                              {task.description && (
                                <div
                                  style={{
                                    fontSize: "12px",
                                    marginTop: "4px",
                                    color: "#555",
                                  }}
                                >
                                  {task.description}
                                </div>
                              )}
                              {/* DUE DATE */}
                              {task.due_date && (
                                <div
                                  style={{
                                    fontSize: "11px",
                                    marginTop: "6px",
                                    opacity: 0.7,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                  }}
                                >
                                  Due By: {new Date(task.due_date).toLocaleString()}
                                </div>
                              )}
                              {/* 🔍 ASSIGN DROPDOWN */}
                              {activeTaskId === task.id && (
                                <div
                                  style={{
                                    marginTop: "8px",
                                    background: "white",
                                    padding: "8px",
                                    borderRadius: "8px",
                                    boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
                                  }}
                                >
                                  <input
                                    type="text"
                                    placeholder="Search team..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    style={{
                                      width: "100%",
                                      padding: "6px",
                                      marginBottom: "6px",
                                      borderRadius: "6px",
                                      border: "1px solid #ccc",
                                    }}
                                  />

                                  {team
                                    .filter((m) =>
                                      m.name.toLowerCase().includes(search.toLowerCase())
                                    )
                                    .map((member) => (
                                      <div
                                        key={member.id}
                                        onClick={async () => {
                                          const updated = [...(task.assignees || []), member.id]

                                          const { data, error } = await supabase
                                            .from("tasks")
                                            .update({ assignees: updated })
                                            .eq("id", task.id)
                                            .select()

                                          if (error) {
                                            console.error("Assign error:", error)
                                            return
                                          }

                                          if (!data) return

                                          setTasks((prev) =>
                                            prev.map((t) =>
                                              t.id === task.id ? data[0] : t
                                            )
                                          )

                                          await logActivity(task.id, `Assigned ${member.name}`)

                                          setActiveTaskId(null)
                                        }}
                                        style={{
                                          padding: "6px",
                                          cursor: "pointer",
                                          borderRadius: "6px",
                                        }}
                                      >
                                        {member.name}
                                      </div>
                                    ))}
                                </div>
                              )}

                              {/* 👥 ASSIGNED AVATARS */}
                              <div style={{ display: "flex", marginTop: "6px" }}>
                                {task.assignees?.map((id) => {
                                  const member = team.find((m) => m.id === id)
                                  if (!member) return null

                                  return (
                                    <div
                                      key={id}
                                      style={{
                                        width: "20px",
                                        height: "20px",
                                        borderRadius: "50%",
                                        background: member.color,
                                        color: "white",
                                        fontSize: "10px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginRight: "4px",
                                      }}
                                    >
                                      {member.name[0]}
                                    </div>
                                  )
                                })}
                              </div>
                              {activeFlagTaskId === task.id && (
                              <div
                                style={{
                                  marginTop: "8px",
                                  background: "white",
                                  padding: "8px",
                                  borderRadius: "8px",
                                  boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
                                }}
                              >
                                {flags.map((flag) => (
                                  <div
                                    key={flag.name}
                                    onClick={async () => {
                                      const { data, error } = await supabase
                                        .from("tasks")
                                        .update({ flag: flag.name })
                                        .eq("id", task.id)
                                        .select()

                                      if (error) {
                                        console.error(error)
                                        return
                                      }

                                      if (!data) return

                                      setTasks((prev) =>
                                        prev.map((t) =>
                                          t.id === task.id ? data[0] : t
                                        )
                                      )

                                      await logActivity(task.id, `Set flag: ${flag.name}`)

                                      setActiveFlagTaskId(null)
                                    }}
                                    style={{
                                      padding: "6px",
                                      cursor: "pointer",
                                      borderRadius: "6px",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: "12px",
                                        height: "12px",
                                        borderRadius: "50%",
                                        background: flag.color,
                                      }}
                                    />
                                    {flag.name}
                                  </div>
                                ))}
                              </div>
                            )}
                            </>
                          )}
                        </div>
                      )}
                    </Draggable>
                    )
                  })}

                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
          </div>
      </DragDropContext>
      ) : (
  <CalendarView tasks={tasks} />
)} 
    </div>
    {/* RIGHT: TEAM SIDEBAR */}
        
<div
  style={{
    width: "260px",                 
    minHeight: "100vh",             
    position: "sticky",
    top: "0",                       

    display: "flex",
    flexDirection: "column",

    background: "linear-gradient(180deg, #1e3a8a, #1e40af)",
    color: "white",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
    borderRadius: "12px",
    padding: "16px",
  }}
>
  <h3 style={{ textAlign: "center", marginBottom: "12px" }}>
    Team Members:
  </h3>

  {team.map((member) => (
    <div
      key={member.id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "10px",
        padding: "8px",
        borderRadius: "8px",
        background: "rgba(255,255,255,0.2)",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          background: member.color || "#3b82f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: "bold",
        }}
      >
        {member.name[0]}
      </div>

      <span>{member.name}</span>
    </div>
  ))}
</div>
  </div>
{activeDetailTask && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100vh",
      background: "rgba(0,0,0,0.4)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    }}
  >
    <div
      style={{
        width: "80%",
        height: "80%",
        background: "rgba(30,64,175,0.9)",
        backdropFilter: "blur(10px)",
        borderRadius: "16px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        color: "white",
      }}
    >
      {/* HEADER */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
      <button
        onClick={() => setActiveDetailTask(null)}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          background: "rgba(255,255,255,0.15)",
          border: "none",
          borderRadius: "8px",
          padding: "6px 12px",
          color: "white",
          cursor: "pointer",
        }}
      >
        Close
      </button>

      <h2 style={{ margin: 0 }}>{activeDetailTask.title}</h2>

      <p style={{ opacity: 0.7, marginTop: "6px" }}>
        {activeDetailTask.description || "No description"}
      </p>
      </div>

      <div style={{ display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "24px",
                    flex: 1, 
                  }}>

        {/* COMMENTS */}
        <div
          style={{
            marginBottom: "10px",
            padding: "12px",
            borderRadius: "12px",
            background: "rgba(255,255,255,0.15)",
          }}
        >
          <h3>Comments</h3>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {comments.length === 0 && (
              <div style={{ fontSize: "11px", opacity: 0.6 }}>No comments yet</div>
            )}

           {comments.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                  padding: "10px 12px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.15)",
                }}
              >
                {/* LEFT: Message */}
                <div style={{ flex: 1 }}>
                  {c.content}
                </div>
                

                {/* RIGHT: Timestamp */}
                <div
                  style={{
                    fontSize: "11px",
                    opacity: 0.6,
                    marginLeft: "12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {new Date(c.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>

          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(0,0,0,0.25)",
              color: "#ffffff",
              fontSize: "14px",
              lineHeight: "1.5",
              outline: "none",
              marginTop: "10px",
              resize: "none",
            }}
          />
          <button style={{
                    marginTop: "10px",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #2563eb, #60a5fa)",
                    color: "white",
                    fontWeight: "600",
                    cursor: "pointer",
                  }} 
          onClick={addComment}>Add Comment</button>
        </div>

        {/* ACTIVITY */}
        <div style={{
                    marginBottom: "12px",
                    padding: "10px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.1)",
                    borderLeft: "3px solid #60a5fa",
                  }}>
          <h3>Activity</h3>

          {activity.length === 0 && (
            <div style={{ opacity: 0.6 }}>No activity yet</div>
          )}

          {activity.map((a) => (
            <div
              key={a.id}
              style={{
                marginBottom: "12px",
                padding: "10px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.1)",
                borderLeft: "3px solid #60a5fa",
              }}
            >
              <div style={{ fontWeight: "500" }}>{a.action}</div>

              <div style={{ fontSize: "11px", opacity: 0.6 }}>
                {new Date(a.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  </div>
             
  )}
  </>
)
}
export default App
