// Reusable wireframe parts of the App Shell. Functional components, all
// stateless. Sky-blue accents on relevant interaction surfaces.

// --- atoms ---------------------------------------------------------------
const Dot = ({ c = 'var(--ink)' }) =>
<span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block', border: '1.1px solid var(--line)' }} />;


const Avatar = ({ initials, tone = 'sky', size = 22, ring = false }) =>
<span
  className={`avatar ${tone}`}
  style={{
    width: size, height: size,
    fontSize: size < 18 ? 9 : 12,
    borderWidth: size < 18 ? 1.1 : 1.4,
    boxShadow: ring ? '0 0 0 2px var(--paper), 0 0 0 3.4px var(--sky-deep)' : 'none'
  }}>
  {initials}</span>;


const Caret = ({ dir = 'right', size = 8 }) => {
  const map = { right: '▸', down: '▾', left: '◂', up: '▴' };
  return <span style={{ fontSize: size, color: 'var(--ink-soft)' }}>{map[dir]}</span>;
};

const Icon = ({ ch, size = 14, c = 'var(--ink)' }) =>
<span style={{
  fontFamily: 'var(--hand)', fontSize: size, lineHeight: 1, color: c,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: size + 4, height: size + 4
}}>{ch}</span>;


// Hand-drawn-ish icon using a thin square + glyph
const SqIcon = ({ ch, active = false }) =>
<span style={{
  width: 26, height: 26,
  border: '1.3px solid var(--line)',
  borderRadius: '5px 7px 6px 8px / 7px 5px 8px 6px',
  background: active ? 'var(--sky-soft)' : 'var(--paper)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--ink)'
}}>{ch}</span>;


// --- TitleBar (tabs + window controls) -----------------------------------
const Tab = ({ name, active, dirty, onClose = true }) =>
<div
  className="sk wobble-1"
  style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 9px 4px 8px',
    minWidth: 0,
    maxWidth: 170,
    background: active ? 'var(--paper)' : 'var(--paper-2)',
    borderBottom: active ? 'none' : '1.4px solid var(--line)',
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
    borderBottomLeftRadius: active ? 0 : 4,
    borderBottomRightRadius: active ? 0 : 4,
    marginBottom: active ? -1.6 : 0,
    position: 'relative', top: active ? 1 : 0,
    height: 24,
    fontFamily: 'var(--hand)', fontSize: 13,
    fontWeight: active ? 700 : 400,
    color: active ? 'var(--ink)' : 'var(--ink-soft)',
    flex: '0 1 auto'
  }}>
  
    <span style={{ fontSize: 12 }}>📄</span>
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    {dirty && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sky-deep)' }} />}
    {onClose && <span style={{ color: 'var(--ink-faint)', fontSize: 12, marginLeft: 2 }}>×</span>}
  </div>;


const TitleBar = ({ tabs, activeIdx = 0 }) =>
<div
  style={{
    display: 'flex', alignItems: 'flex-end',
    gap: 4,
    padding: '6px 8px 0 10px',
    background: 'var(--paper-2)',
    borderBottom: '1.6px solid var(--line)',
    height: 30,
    flex: '0 0 auto'
  }}>
  
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, flex: '1 1 auto', minWidth: 0 }}>
      {tabs.map((t, i) =>
    <Tab key={i} name={t.name} active={i === activeIdx} dirty={t.dirty} />
    )}
      <button style={{
      marginLeft: 4, marginBottom: 2,
      border: '1.2px dashed var(--ink-faint)',
      background: 'transparent', borderRadius: 4,
      width: 22, height: 22,
      fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--ink-soft)',
      cursor: 'pointer'
    }}>+</button>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, marginLeft: 8 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>─</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>▢</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>×</span>
    </div>
  </div>;


// --- TopNavbar -----------------------------------------------------------
const Breadcrumb = ({ parts }) =>
<div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--hand)', fontSize: 14 }}>
    {parts.map((p, i) =>
  <React.Fragment key={i}>
        <span style={{
      color: i === parts.length - 1 ? 'var(--ink)' : 'var(--ink-soft)',
      fontWeight: i === parts.length - 1 ? 700 : 400,
      cursor: i === parts.length - 1 ? 'default' : 'pointer',
      textDecoration: i === parts.length - 1 ? 'none' : 'none'
    }}>{p}</span>
        {i < parts.length - 1 && <span style={{ color: 'var(--ink-faint)' }}>/</span>}
      </React.Fragment>
  )}
  </div>;


const TopNavbar = ({ breadcrumb, avatars = [], avatarOverflow = 0, focusing = false, focusActive = false }) =>
<div style={{
  display: 'flex', alignItems: 'center',
  padding: '7px 14px',
  background: 'var(--paper)',
  borderBottom: '1.6px solid var(--line)',
  height: 38, gap: 12, flex: '0 0 auto'
}}>
    {/* Nav left */}
    <div style={{ display: 'flex', gap: 4 }}>
      <SqIcon ch="←" />
      <SqIcon ch="→" />
    </div>
    {/* Breadcrumb (center-ish, left-aligned) */}
    <div style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
      <Breadcrumb parts={breadcrumb} />
    </div>
    {/* Avatar group */}
    <div style={{ display: 'flex', alignItems: 'center', gap: -4 }}>
      <div style={{ display: 'flex' }}>
        {avatars.map((a, i) =>
      <span key={i} style={{ marginLeft: i === 0 ? 0 : -6 }}>
            <Avatar initials={a.initials} tone={a.tone} ring={a.you} />
          </span>
      )}
        {avatarOverflow > 0 &&
      <span style={{ marginLeft: -6 }}>
            <span className="avatar" style={{
          background: 'var(--paper-2)', fontFamily: 'var(--hand)', fontSize: 10
        }}>+{avatarOverflow}</span>
          </span>
      }
      </div>
    </div>
    {/* Focus following button */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
      className="sk wobble-2"
      style={{
        padding: '3px 9px',
        background: focusActive ? 'var(--sky)' : 'var(--paper)',
        color: focusActive ? '#fff' : 'var(--ink)',
        fontFamily: 'var(--hand)', fontSize: 13,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        borderColor: focusActive ? 'var(--sky-deep)' : 'var(--line)'
      }}>
      
        <span>📡</span>
        <span>{focusActive ? '공유 중' : '공유'}</span>
      </span>
      <SqIcon ch="⋯" />
    </div>
  </div>;


// --- LeftSidebar (expanded) ----------------------------------------------
const PageItem = ({ name, depth = 0, active = false, hasChildren = false, open = false, avatars = [], icon = '📄' }) =>
<div style={{
  display: 'flex', alignItems: 'center',
  padding: '4px 8px 4px ' + (8 + depth * 14) + 'px',
  background: active ? 'var(--sky-soft)' : 'transparent',
  borderRadius: 4,
  fontFamily: 'var(--hand)', fontSize: 14,
  color: 'var(--ink)',
  gap: 4,
  cursor: 'pointer',
  fontWeight: active ? 700 : 400
}}>
    <span style={{ width: 10, color: 'var(--ink-faint)' }}>
      {hasChildren ? open ? '▾' : '▸' : ''}
    </span>
    <span style={{ fontSize: 12 }}>{icon}</span>
    <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    {avatars.length > 0 &&
  <span style={{ display: 'flex' }}>
        {avatars.map((a, i) =>
    <span key={i} style={{ marginLeft: i === 0 ? 0 : -4 }}>
            <Avatar initials={a.initials} tone={a.tone} size={14} />
          </span>
    )}
      </span>
  }
  </div>;


const LeftSidebarExpanded = ({ active = '02-Capde-Draft' }) =>
<div style={{
  width: 232, flex: '0 0 auto',
  borderRight: '1.6px solid var(--line)',
  display: 'flex', flexDirection: 'column',
  background: 'var(--paper)'
}}>
    {/* Header */}
    <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 10px 6px',
    borderBottom: '1.2px solid var(--line)'
  }}>
      <span style={{ fontFamily: 'var(--hand)', fontWeight: 700, fontSize: 14, flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        RMF Block
      </span>
      <SqIcon ch="+" />
      <SqIcon ch="«" />
    </div>
    {/* Search */}
    <div style={{ padding: '8px 10px 4px' }}>
      <div className="sk wobble-1" style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 8px',
      background: 'var(--paper-2)',
      fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--ink-faint)'
    }}>
        <span>🔍</span><span>검색…</span>
      </div>
    </div>
    {/* Tree */}
    <div style={{ padding: '6px 4px', overflow: 'hidden', flex: '1 1 auto' }}>
      <div className="label-cap" style={{ padding: '4px 8px 4px' }}>PAGES</div>
      <PageItem name="README" icon="📌" />
      <PageItem name="초안" icon="📁" hasChildren open avatars={[{ initials: 'J', tone: 'yel' }]} />
      <PageItem name="Capde Draft" depth={1} active icon="📄" avatars={[
    { initials: 'M', tone: 'sky' }, { initials: 'J', tone: 'yel' }, { initials: 'S', tone: 'pnk' }]
    } />
      <PageItem name="브레인스토밍" depth={1} icon="📄" />
      <PageItem name="API 명세서" depth={1} icon="📄" avatars={[{ initials: 'D', tone: 'grn' }]} />
      <PageItem name="회의록" icon="📁" hasChildren open />
      <PageItem name="2026-05-25 킥오프" depth={1} icon="📄" />
      <PageItem name="2026-05-22 사전 미팅" depth={1} icon="📄" />
      <PageItem name="리서치" icon="📁" hasChildren={true} open={false} />
      <PageItem name="레퍼런스 자료" icon="📁" hasChildren={true} open={false} />
    </div>
    {/* Sidebar footer hint */}
    <div style={{
    padding: '6px 10px',
    borderTop: '1.2px solid var(--line)',
    fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)',
    letterSpacing: '.06em'
  }}>
      ⌥ + 클릭 → 새 탭
    </div>
  </div>;


const LeftSidebarCollapsed = () =>
<div style={{
  width: 44, flex: '0 0 auto',
  borderRight: '1.6px solid var(--line)',
  display: 'flex', flexDirection: 'column',
  background: 'var(--paper-2)',
  alignItems: 'center',
  gap: 8, padding: '10px 0'
}}>
    <SqIcon ch="»" />
    <SqIcon ch="🔍" />
    <div style={{ width: 24, height: 1.2, background: 'var(--ink-faint)', margin: '4px 0' }} />
    <SqIcon ch="📁" />
    <SqIcon ch="📄" active />
    <SqIcon ch="📄" />
    <SqIcon ch="📄" />
  </div>;


// --- Editor body ---------------------------------------------------------
const EditorBlock = ({ kind = 'p', selectedBy }) => {
  const lineByKind = {
    h1: <div className="H1" />,
    h2: <div className="H2" />,
    h3: <div className="H3" />,
    p:
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div className="blk long" />
        <div className="blk mid" />
      </div>,

    p2:
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div className="blk long" />
        <div className="blk long" />
        <div className="blk short" />
      </div>,

    li:
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 5, height: 5, background: 'var(--ink-soft)', borderRadius: '50%' }} />
        <div className="blk mid" />
      </div>,

    code:
    <div className="codeblk">
        <div style={{ opacity: .85 }}>{`function discover() {`}</div>
        <div style={{ opacity: .65, paddingLeft: 16 }}>{`return mdns.scan('_localguard._tcp')`}</div>
        <div style={{ opacity: .85 }}>{`}`}</div>
      </div>,

    img: <div className="imgph" style={{ height: 90 }}>image placeholder</div>,
    quote:
    <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ width: 3, background: 'var(--sky-deep)', borderRadius: 2 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 2 }}>
          <div className="blk mid" />
          <div className="blk short" />
        </div>
      </div>

  };
  return (
    <div style={{ position: 'relative', padding: '4px 0' }}>
      {selectedBy &&
      <div style={{
        position: 'absolute', left: -8, top: 0, bottom: 0, width: 2,
        background: selectedBy.color, borderRadius: 2
      }} />
      }
      {lineByKind[kind]}
      {selectedBy &&
      <span style={{
        position: 'absolute', left: -8, top: -10,
        background: selectedBy.color, color: '#fff',
        fontFamily: 'var(--hand)', fontSize: 10,
        padding: '0 5px', borderRadius: 3,
        lineHeight: 1.4
      }}>{selectedBy.name}</span>
      }
    </div>);

};

const FloatingTOC = ({ active = 0 }) => {
  const items = ['개요', '디자인 철학', 'App Shell', '컴포넌트 명세', '인터랙션 흐름', '제약 사항'];
  return (
    <div style={{
      position: 'absolute', right: 16, top: 28,
      width: 150,
      fontFamily: 'var(--hand)', fontSize: 12,
      color: 'var(--ink-soft)',
      display: 'flex', flexDirection: 'column', gap: 4
    }}>
      <div className="label-cap" style={{ marginBottom: 4 }}>ON THIS PAGE</div>
      {items.map((it, i) =>
      <div key={i} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: i === active ? 'var(--ink)' : 'var(--ink-soft)',
        fontWeight: i === active ? 700 : 400
      }}>
          <span style={{
          width: 2, height: 12,
          background: i === active ? 'var(--sky-deep)' : 'var(--ink-faint)',
          borderRadius: 2,
          opacity: i === active ? 1 : .35
        }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it}</span>
        </div>
      )}
    </div>);

};

// Other-user cursor inline
const RemoteCursor = ({ name, color = 'var(--sky-deep)', top, left }) =>
<div style={{ position: 'absolute', top, left, pointerEvents: 'none' }}>
    <div style={{ width: 2, height: 14, background: color }} />
    <div style={{
    position: 'absolute', top: 14, left: -1,
    background: color, color: '#fff',
    fontFamily: 'var(--hand)', fontSize: 10,
    padding: '1px 5px',
    borderRadius: '0 3px 3px 3px',
    whiteSpace: 'nowrap'
  }}>{name}</div>
  </div>;


// --- Bottom status bar ---------------------------------------------------
const BottomStatusBar = ({ chatOpen = false, hasUnread = false }) =>
<div style={{
  display: 'flex', alignItems: 'center',
  padding: '4px 12px',
  borderTop: '1.6px solid var(--line)',
  background: 'var(--paper-2)',
  height: 24, flex: '0 0 auto',
  fontFamily: 'var(--hand)', fontSize: 12,
  color: 'var(--ink-soft)',
  gap: 12
}}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: 'var(--sky-deep)' }}>●</span>
      <span>📡 LAN — 4명 연결됨</span>
    </span>
    <span style={{ color: 'var(--ink-faint)' }}>·</span>
    <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>192.168.4.31  ·  workspace://hackathon-26</span>
    <span style={{ flex: '1 1 auto' }} />
    <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '1px 8px',
    border: '1.2px solid var(--line)',
    borderRadius: 999,
    background: chatOpen ? 'var(--sky-soft)' : 'var(--paper)',
    position: 'relative'
  }}>
      💬 채팅
      {hasUnread &&
    <span style={{
      position: 'absolute', top: -3, right: -3,
      width: 10, height: 10, borderRadius: '50%',
      background: 'var(--sky-deep)', border: '1.2px solid var(--paper-2)'
    }} />
    }
    </span>
  </div>;


// --- ChatPanel (docked) --------------------------------------------------
const ChatMessage = ({ name, time, body, kind = 'text', tone = 'sky' }) => {
  if (kind === 'system') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        margin: '6px 0', padding: '4px 10px',
        fontFamily: 'var(--hand)', fontSize: 12,
        color: 'var(--ink-soft)',
        justifyContent: 'center'
      }}>
        <span style={{ flex: 1, height: 1, background: 'var(--ink-faint)', opacity: .4 }} />
        <span>{body}</span>
        <span className="tag sky" style={{ fontSize: 11 }}>참여하기</span>
        <span style={{ flex: 1, height: 1, background: 'var(--ink-faint)', opacity: .4 }} />
      </div>);

  }
  if (kind === 'file') {
    return (
      <div style={{ display: 'flex', gap: 8, padding: '6px 10px' }}>
        <Avatar initials={name[0]} tone={tone} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--hand)', fontSize: 12 }}>
            <strong>{name}</strong> <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono)', fontSize: 10 }}>{time}</span>
          </div>
          <div className="sk wobble-2" style={{
            marginTop: 4, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--paper-2)'
          }}>
            <span style={{ fontSize: 18 }}>📎</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--hand)', fontSize: 13 }}>{body}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)' }}>PDF · 1.2 MB</div>
            </div>
            <span className="tag">열기</span>
            <span className="tag">↓</span>
          </div>
        </div>
      </div>);

  }
  return (
    <div style={{ display: 'flex', gap: 8, padding: '4px 10px' }}>
      <Avatar initials={name[0]} tone={tone} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--hand)', fontSize: 12 }}>
          <strong>{name}</strong> <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono)', fontSize: 10 }}>{time}</span>
        </div>
        <div style={{ fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}>{body}</div>
      </div>
    </div>);

};

Object.assign(window, {
  Dot, Avatar, Caret, Icon, SqIcon,
  Tab, TitleBar, Breadcrumb, TopNavbar,
  PageItem, LeftSidebarExpanded, LeftSidebarCollapsed,
  EditorBlock, FloatingTOC, RemoteCursor,
  BottomStatusBar, ChatMessage
});


// Four App Shell variants — each is a fixed-size composition.

const SHELL_W = 1280;
const SHELL_H = 820;

const EDITOR_USERS = [
{ initials: 'M', tone: 'sky', you: true, name: '나' },
{ initials: 'J', tone: 'yel', name: '재훈' },
{ initials: 'S', tone: 'pnk', name: '소영' },
{ initials: 'D', tone: 'grn', name: '동현' }];


// Re-used editor body
const EditorBody = ({ withRemoteCursors = false, withSelections = false, narrow = false }) =>
<div style={{
  position: 'relative',
  padding: '36px ' + (narrow ? 60 : 80) + 'px 40px',
  maxWidth: 720, margin: '0 auto',
  fontFamily: 'var(--hand)', color: 'var(--ink)'
}}>
    {/* page title */}
    <div style={{ fontFamily: 'var(--hand)', fontWeight: 700, fontSize: 28, lineHeight: 1.1 }}>
      Capde Draft
    </div>
    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', marginTop: 6, letterSpacing: '.06em' }}>
      LAST EDITED · 2분 전 · 재훈
    </div>

    <div style={{ height: 22 }} />

    {/* H2 */}
    <div style={{ fontFamily: 'var(--hand)', fontWeight: 700, fontSize: 19, marginBottom: 8 }}>제품 개요</div>
    <EditorBlock kind="p2" />
    <div style={{ height: 14 }} />
    <EditorBlock kind="p" />

    <div style={{ height: 22 }} />

    {/* H2 with remote selection */}
    <div style={{
    fontFamily: 'var(--hand)', fontWeight: 700, fontSize: 19, marginBottom: 8,
    position: 'relative'
  }}>
      디자인 철학
      {withSelections &&
    <span style={{
      position: 'absolute', top: -2, right: '15%',
      background: '#f59e0b', color: '#fff',
      fontFamily: 'var(--hand)', fontSize: 10,
      padding: '0 5px', borderRadius: 3
    }}>재훈</span>
    }
    </div>
    <div style={{ position: 'relative' }}>
      {withSelections &&
    <div style={{
      position: 'absolute', left: -8, top: 0, bottom: 0, width: 2,
      background: '#f59e0b', borderRadius: 2
    }} />
    }
      <EditorBlock kind="li" />
      <div style={{ height: 6 }} />
      <EditorBlock kind="li" />
      <div style={{ height: 6 }} />
      <EditorBlock kind="li" />
    </div>

    <div style={{ height: 18 }} />
    <EditorBlock kind="quote" />

    <div style={{ height: 22 }} />

    {/* H2 + code */}
    <div style={{ fontFamily: 'var(--hand)', fontWeight: 700, fontSize: 19, marginBottom: 8 }}>App Shell 구조</div>
    <EditorBlock kind="p" />
    <div style={{ height: 12 }} />
    <EditorBlock kind="code" />

    <div style={{ height: 22 }} />

    {/* H2 + image */}
    <div style={{ fontFamily: 'var(--hand)', fontWeight: 700, fontSize: 19, marginBottom: 8 }}>레퍼런스 스크린샷</div>
    <EditorBlock kind="img" />

    <div style={{ height: 24 }} />

    {/* H2 */}
    <div style={{ fontFamily: 'var(--hand)', fontWeight: 700, fontSize: 19, marginBottom: 8 }}>인터랙션 흐름</div>
    <EditorBlock kind="p2" />

    {/* remote cursor */}
    {withRemoteCursors &&
  <>
        <RemoteCursor name="소영" color="#ec4899" top={362} left={220} />
        <RemoteCursor name="동현" color="#10b981" top={520} left={120} />
      </>
  }
  </div>;


// ============================================================
// V1 — Default state
// ============================================================
const VariantDefault = () =>
<div className="shell">
    <TitleBar
    activeIdx={0}
    tabs={[
    { name: 'Capde Draft' },
    { name: 'API 명세서', dirty: true },
    { name: '회의록 05-25' }]
    } />
  
    <TopNavbar
    breadcrumb={['초안', 'Capde Draft']}
    avatars={[
    { initials: 'M', tone: 'sky', you: true },
    { initials: 'J', tone: 'yel' },
    { initials: 'S', tone: 'pnk' }]
    } />
  
    <div className="row grow" style={{ flex: '1 1 auto', minHeight: 0 }}>
      <LeftSidebarExpanded />
      <div className="grow" style={{ position: 'relative', overflow: 'hidden', background: 'var(--paper)' }}>
        <EditorBody />
        <FloatingTOC active={2} />
      </div>
    </div>
    <BottomStatusBar />
  </div>;


// ============================================================
// V2 — Focused mode: sidebar collapsed, chat floating
// ============================================================
const FloatingChat = ({ x = 880, y = 110 }) =>
<div
  className="sk"
  style={{
    position: 'absolute', left: x, top: y,
    width: 320, height: 380,
    background: 'var(--paper)',
    boxShadow: '0 16px 36px rgba(28,27,26,0.18), 0 2px 6px rgba(28,27,26,0.1)',
    borderRadius: 8,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    zIndex: 10
  }}>
  
    {/* header */}
    <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 10px',
    borderBottom: '1.4px solid var(--line)',
    background: 'var(--paper-2)',
    cursor: 'grab'
  }}>
      <span style={{ fontSize: 14 }}>💬</span>
      <span style={{ fontFamily: 'var(--hand)', fontWeight: 700, fontSize: 13, flex: 1 }}>채팅</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>─</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>⇲</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>×</span>
    </div>
    {/* tabs */}
    <div style={{ display: 'flex', gap: 4, padding: '4px 8px 0', borderBottom: '1.2px solid var(--ink-faint)' }}>
      <div style={{
      padding: '4px 8px', fontFamily: 'var(--hand)', fontSize: 12,
      fontWeight: 700, borderBottom: '2.4px solid var(--sky-deep)',
      marginBottom: -1.4
    }}>채팅</div>
      <div style={{
      padding: '4px 8px', fontFamily: 'var(--hand)', fontSize: 12,
      color: 'var(--ink-soft)',
      display: 'inline-flex', alignItems: 'center', gap: 4
    }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sky-deep)', boxShadow: '0 0 0 2px rgba(14,165,233,0.22)' }} />
        팔로잉
      </div>
      <div style={{
      padding: '4px 8px', fontFamily: 'var(--hand)', fontSize: 12,
      color: 'var(--ink-soft)'
    }}>파일 <span style={{ color: 'var(--sky-deep)' }}>·3</span></div>
    </div>
    {/* messages */}
    <div style={{ flex: '1 1 auto', overflow: 'hidden', padding: '4px 0', display: 'flex', flexDirection: 'column' }}>
      <ChatMessage name="재훈" time="14:02" tone="yel" body="API 명세서 초안 올렸어요. 봐주세요!" />
      <ChatMessage name="재훈" time="14:02" tone="yel" kind="file" body="localguard-api-v0.pdf" />
      <ChatMessage name="소영" time="14:05" tone="pnk" body="블록 락 정책 정해야 할 듯" />
      <ChatMessage kind="system" body="동현이 화면 공유를 시작했습니다" />
      <ChatMessage name="나" time="14:08" tone="sky" body="OK 곧 합류" />
    </div>
    {/* input */}
    <div style={{ padding: 8, borderTop: '1.2px solid var(--line)' }}>
      <div className="sk wobble-1" style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 8px',
      background: 'var(--paper-2)'
    }}>
        <span style={{ fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--ink-faint)', flex: 1 }}>메시지…</span>
        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>📎</span>
        <span style={{
        background: 'var(--sky)', color: '#fff',
        padding: '1px 8px', borderRadius: 999,
        fontFamily: 'var(--hand)', fontSize: 12, fontWeight: 700
      }}>↵</span>
      </div>
    </div>
  </div>;


const VariantFocus = () =>
<div className="shell">
    <TitleBar
    activeIdx={0}
    tabs={[
    { name: 'Capde Draft' },
    { name: 'API 명세서', dirty: true }]
    } />
  
    <TopNavbar
    breadcrumb={['초안', 'Capde Draft']}
    avatars={[
    { initials: 'M', tone: 'sky', you: true },
    { initials: 'J', tone: 'yel' },
    { initials: 'S', tone: 'pnk' }]
    } />
  
    <div className="row grow" style={{ flex: '1 1 auto', minHeight: 0, position: 'relative' }}>
      <LeftSidebarCollapsed />
      <div className="grow" style={{ position: 'relative', overflow: 'hidden', background: 'var(--paper)' }}>
        <EditorBody />
        <FloatingChat x={760} y={64} />
        {/* TOC hidden — narrow */}
      </div>
    </div>
    <BottomStatusBar chatOpen />
  </div>;


// ============================================================
// V3 — Active collaboration: focus following + block floating
// ============================================================
const FollowingBanner = () =>
<div style={{
  position: 'absolute', top: 0, left: 0, right: 0,
  background: 'var(--sky-soft)',
  borderBottom: '1.6px solid var(--sky-deep)',
  padding: '6px 16px',
  display: 'flex', alignItems: 'center', gap: 10,
  fontFamily: 'var(--hand)', fontSize: 13,
  zIndex: 4
}}>
    <Avatar initials="D" tone="grn" size={20} />
    <span style={{ flex: 1 }}>
      <strong>동현</strong>의 시점을 따라가는 중 · <span style={{ color: 'var(--ink-soft)' }}>API 명세서 페이지</span>
    </span>
    <span className="tag" style={{ background: 'var(--paper)' }}>⏸ 일시 중지</span>
    <span className="tag" style={{ background: 'var(--paper)' }}>그만 따라가기</span>
  </div>;


const FloatingBlock = ({ x, y, w = 240, h = 130, title = '미러된 블록', kind = 'text', tone = 'sky' }) =>
<div
  className="sk"
  style={{
    position: 'absolute', left: x, top: y,
    width: w, height: h,
    background: 'var(--paper)',
    boxShadow: '0 12px 28px rgba(28,27,26,0.16), 0 1px 4px rgba(28,27,26,0.08)',
    borderRadius: 8,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 6
  }}>
  
    <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 8px',
    borderBottom: '1.2px dashed var(--line)',
    background: `var(--${tone === 'yel' ? 'warm-yellow' : 'sky-soft'})`,
    fontFamily: 'var(--hand)', fontSize: 11,
    color: 'var(--ink-soft)'
  }}>
      <span style={{ fontSize: 11 }}>🪟</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>×</span>
    </div>
    <div style={{ padding: '8px 10px', flex: 1, overflow: 'hidden' }}>
      {kind === 'text' &&
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="H2" />
          <div className="blk long" />
          <div className="blk mid" />
          <div className="blk short" />
        </div>
    }
      {kind === 'img' &&
    <div className="imgph" style={{ height: '100%' }}>topology diagram</div>
    }
    </div>
  </div>;


const LaserPointer = ({ x, y, name = '동현', color = '#10b981' }) =>
<div style={{ position: 'absolute', left: x, top: y, zIndex: 5, pointerEvents: 'none' }}>
    <div style={{
    width: 16, height: 16, borderRadius: '50%',
    background: color, opacity: .35,
    position: 'absolute', left: -8, top: -8
  }} />
    <div style={{
    width: 8, height: 8, borderRadius: '50%',
    background: color,
    position: 'absolute', left: -4, top: -4,
    boxShadow: `0 0 0 1.5px #fff`
  }} />
    <div style={{
    position: 'absolute', left: 10, top: 6,
    background: color, color: '#fff',
    fontFamily: 'var(--hand)', fontSize: 10,
    padding: '0 5px', borderRadius: 3
  }}>{name}</div>
  </div>;


const VariantCollab = () =>
<div className="shell">
    <TitleBar
    activeIdx={1}
    tabs={[
    { name: 'Capde Draft' },
    { name: 'API 명세서' },
    { name: '회의록 05-25', dirty: true }]
    } />
  
    <TopNavbar
    breadcrumb={['초안', 'API 명세서']}
    avatars={[
    { initials: 'M', tone: 'sky', you: true },
    { initials: 'J', tone: 'yel' },
    { initials: 'S', tone: 'pnk' },
    { initials: 'D', tone: 'grn' }]
    }
    focusActive />
  
    <div className="row grow" style={{ flex: '1 1 auto', minHeight: 0, position: 'relative' }}>
      <LeftSidebarExpanded active="API 명세서" />
      <div className="grow" style={{ position: 'relative', overflow: 'hidden', background: 'var(--paper)' }}>
        <FollowingBanner />
        <div style={{ paddingTop: 30, height: '100%' }}>
          <EditorBody withRemoteCursors withSelections />
        </div>
        <LaserPointer x={420} y={300} />
        <FloatingBlock x={840} y={120} w={260} h={150} title="제품 개요 (미러)" kind="text" />
        <FloatingBlock x={870} y={310} w={240} h={170} title="네트워크 토폴로지" kind="img" tone="yel" />
        <FloatingTOC active={2} />
      </div>
    </div>
    <BottomStatusBar hasUnread />
  </div>;


// ============================================================
// V4 — Chat drawer expanded (docked bottom)
// ============================================================
// --- Tab content panes ---------------------------------------------------
const ChatTabPane = () =>
<div style={{ flex: '1 1 auto', overflow: 'hidden', padding: '6px 0' }}>
    <ChatMessage name="재훈" time="14:02" tone="yel" body="API 명세서 초안 올렸어요. 한 번 봐주세요!" />
    <ChatMessage name="재훈" time="14:02" tone="yel" kind="file" body="localguard-api-v0.pdf" />
    <ChatMessage name="소영" time="14:05" tone="pnk" body="블록 락 정책 결정 필요. 동시 편집은 last-write-wins?" />
    <ChatMessage kind="system" body="동현이 화면 공유를 시작했습니다" />
    <ChatMessage name="나" time="14:08" tone="sky" body="OK 잠시만, 따라갈게요" />
    <ChatMessage name="동현" time="14:09" tone="grn" body="여기 LAN 디스커버리 부분부터 볼게요" />
  </div>;


const FileRow = ({ icon, name, sender, time, size, tone = 'sky' }) =>
<div style={{
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '8px 14px',
  borderBottom: '1px dashed rgba(28,27,26,0.18)'
}}>
    <span style={{
    width: 32, height: 32, flex: '0 0 auto',
    background: 'var(--paper-2)',
    border: '1.2px solid var(--line)',
    borderRadius: 5,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16
  }}>{icon}</span>
    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
      <div style={{
      fontFamily: 'var(--hand)', fontSize: 13, fontWeight: 700,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
    }}>{name}</div>
      <div style={{
      fontFamily: 'var(--hand)', fontSize: 11, color: 'var(--ink-soft)',
      display: 'flex', alignItems: 'center', gap: 6
    }}>
        <Avatar initials={sender[0]} tone={tone} size={14} />
        <span>{sender}</span>
        <span style={{ color: 'var(--ink-faint)' }}>·</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{time}</span>
        <span style={{ color: 'var(--ink-faint)' }}>·</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{size}</span>
      </div>
    </div>
    <span className="tag" style={{ fontSize: 11 }}>열기</span>
    <span className="tag" style={{ fontSize: 11 }}>↓</span>
  </div>;


const FileTabPane = () =>
<div style={{ flex: '1 1 auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
    {/* Filter bar */}
    <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 14px 6px',
    borderBottom: '1.2px solid var(--line)',
    background: 'var(--paper-2)'
  }}>
      <span className="tag sky" style={{ fontWeight: 700, fontSize: 11 }}>전체 · 3</span>
      <span className="tag" style={{ fontSize: 11 }}>📄 PDF</span>
      <span className="tag" style={{ fontSize: 11 }}>🖼 이미지</span>
      <span className="tag" style={{ fontSize: 11 }}>📎 기타</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)' }}>최신순</span>
    </div>
    <div style={{ flex: 1, overflowY: 'hidden' }}>
      <FileRow icon="📄" name="localguard-api-v0.pdf" sender="재훈" tone="yel" time="14:02" size="1.2 MB" />
      <FileRow icon="🖼" name="topology-diagram.png" sender="소영" tone="pnk" time="13:48" size="340 KB" />
      <FileRow icon="📄" name="mdns-scan-log.txt" sender="동현" tone="grn" time="13:20" size="12 KB" />
    </div>
    <div style={{
    padding: '6px 14px',
    borderTop: '1.2px dashed var(--ink-faint)',
    fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)',
    letterSpacing: '.04em'
  }}>
      파일을 끌어서 놓으면 채팅 + 파일 탭에 동시 누적
    </div>
  </div>;


const FocusLogRow = ({ time, icon, body, accent = false }) =>
<div style={{
  display: 'flex', alignItems: 'flex-start', gap: 8,
  padding: '3px 14px',
  fontFamily: 'var(--hand)', fontSize: 12,
  color: accent ? 'var(--ink)' : 'var(--ink-soft)'
}}>
    <span style={{
    fontFamily: 'var(--mono)', fontSize: 10,
    color: 'var(--ink-faint)', width: 38, flex: '0 0 auto',
    paddingTop: 2
  }}>{time}</span>
    <span style={{ width: 14, flex: '0 0 auto', textAlign: 'center' }}>{icon}</span>
    <span style={{ flex: 1, minWidth: 0 }}>{body}</span>
  </div>;


// ----- Focus following session card (Discord-style square) -----
const FocusSessionCard = ({ presenter, page, presenterTone = 'sky', followers = [], joined = false, time = '04:21', isMe = false }) =>
<div style={{
  aspectRatio: '1 / 1',
  background: 'var(--paper)',
  border: '1.4px solid var(--sky-deep)',
  borderRadius: 8,
  padding: '8px 9px',
  display: 'flex', flexDirection: 'column',
  position: 'relative',
  boxShadow: '0 1px 3px rgba(28,27,26,0.06)',
  minWidth: 0
}}>
    {/* LIVE badge top-left */}
    <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 3,
    fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: '.06em',
    color: 'var(--sky-deep)', fontWeight: 700
  }}>
      <span style={{
      width: 5, height: 5, borderRadius: '50%',
      background: 'var(--sky-deep)',
      boxShadow: '0 0 0 3px rgba(56,189,248,0.25)',
      animation: 'edcblink 1.6s steps(1) infinite'
    }} />
      LIVE
      <span style={{ flex: 1 }} />
      <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>{time}</span>
    </div>
    {/* Avatar centered */}
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, position: 'relative' }}>
      <span style={{
      position: 'absolute',
      width: 56, height: 56, borderRadius: '50%',
      background: 'rgba(56,189,248,0.12)'
    }} />
      <span style={{
      position: 'relative', zIndex: 1,
      boxShadow: '0 0 0 2px var(--paper), 0 0 0 4px var(--sky-deep)',
      borderRadius: '50%'
    }}>
        <Avatar initials={presenter[0]} tone={presenterTone} size={36} />
      </span>
    </div>
    {/* Name + page */}
    <div style={{ textAlign: 'center', marginTop: 4, minWidth: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.2 }}>
        {presenter}{isMe && <span style={{ color: 'var(--sky-deep)', fontWeight: 400, fontSize: 10 }}> · 나</span>}
      </div>
      <div style={{
      fontSize: 10, color: 'var(--ink-soft)',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      marginTop: 1
    }}>→ {page}</div>
    </div>
    {/* Followers + join CTA */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
        {followers.slice(0, 3).map((f, i) =>
      <span key={i} style={{ marginLeft: i === 0 ? 0 : -4 }}>
            <Avatar initials={f.initials} tone={f.tone} size={14} />
          </span>
      )}
        {followers.length > 3 &&
      <span style={{ marginLeft: -4 }}>
            <span className="avatar" style={{ width: 14, height: 14, fontSize: 8, borderWidth: 1.1, background: 'var(--paper-2)' }}>+{followers.length - 3}</span>
          </span>
      }
        {followers.length === 0 &&
      <span style={{ fontSize: 9, color: 'var(--ink-faint)' }}>아직 없음</span>
      }
      </div>
      {isMe ?
    <span style={{
      padding: '2px 7px', borderRadius: 999,
      background: 'var(--paper)', color: 'var(--ink)',
      border: '1.2px solid var(--line)',
      fontSize: 10, fontWeight: 700
    }}>⏹ 중단</span> :
    joined ?
    <span style={{
      padding: '2px 7px', borderRadius: 999,
      background: 'var(--sky-soft)', color: 'var(--sky-deep)',
      border: '1.2px solid var(--sky-deep)',
      fontSize: 10, fontWeight: 700
    }}>참여 중</span> :

    <span style={{
      padding: '2px 8px', borderRadius: 999,
      background: 'var(--sky)', color: '#fff',
      fontSize: 10, fontWeight: 700,
      border: '1.2px solid var(--sky-deep)'
    }}>참여</span>
    }
    </div>
  </div>;


const FocusTabPane = ({ sessions, multi = false }) => {
  const defaultSessions = [
  { presenter: '동현', presenterTone: 'grn', page: 'API 명세서', joined: true, time: '04:21',
    followers: [{ initials: 'M', tone: 'sky' }, { initials: 'J', tone: 'yel' }, { initials: 'S', tone: 'pnk' }] },
  { presenter: '소영', presenterTone: 'pnk', page: '회의록 05-25', joined: false, time: '01:08',
    followers: [{ initials: 'J', tone: 'yel' }] }];

  const data = sessions || defaultSessions;
  return (
    <div style={{ flex: '1 1 auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Section header */}
      <div style={{
        padding: '8px 14px 4px',
        display: 'flex', alignItems: 'center', gap: 6
      }}>
        <div className="label-cap">현재 공유 중</div>
        <span style={{
          background: 'var(--sky)', color: '#fff',
          fontSize: 9, fontFamily: 'var(--mono)',
          padding: '0 5px', borderRadius: 999,
          fontWeight: 700, letterSpacing: '.04em'
        }}>{data.length}</span>
      </div>
      {/* Grid of session cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8,
        padding: '0 14px 10px',
        overflowY: 'hidden'
      }}>
        {data.map((s, i) => <FocusSessionCard key={i} {...s} />)}
      </div>
      {/* Start-your-own */}
      <div style={{
        margin: '4px 14px 10px',
        padding: '8px 12px',
        border: '1.4px dashed var(--ink-faint)',
        borderRadius: 6,
        display: 'flex', alignItems: 'center', gap: 10
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>내가 발표 시작하기</div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
            내 시점을 워크스페이스에 공유합니다
          </div>
        </div>
        <span style={{
          background: 'var(--sky)', color: '#fff',
          padding: '4px 12px', borderRadius: 999,
          fontSize: 12, fontWeight: 700,
          border: '1.4px solid var(--sky-deep)'
        }}>📡 시작</span>
      </div>
    </div>);

};

// --- Tab strip -----------------------------------------------------------
const ChatTab = ({ label, active, count, live }) =>
<span style={{
  padding: '3px 10px',
  fontFamily: 'var(--hand)', fontSize: 12,
  background: active ? 'var(--sky-soft)' : 'transparent',
  borderRadius: 999,
  fontWeight: active ? 700 : 400,
  border: active ? '1.2px solid var(--sky-deep)' : '1.2px solid transparent',
  color: active ? 'var(--ink)' : 'var(--ink-soft)',
  display: 'inline-flex', alignItems: 'center', gap: 4,
  cursor: 'pointer'
}}>
    {live &&
  <span style={{
    width: 6, height: 6, borderRadius: '50%', background: 'var(--sky-deep)',
    boxShadow: '0 0 0 2px rgba(14,165,233,0.22)'
  }} />
  }
    <span>{label}</span>
    {count != null &&
  <span style={{
    color: active ? 'var(--sky-deep)' : 'var(--ink-faint)',
    fontWeight: 700,
    fontFamily: 'var(--mono)', fontSize: 10
  }}>{count}</span>
  }
  </span>;


// --- Bottom-right docked chat panel (50% width, resizable) ---------------
const ChatPanelDocked = ({ tab = 'chat', widthPct = 50 }) =>
<div style={{
  position: 'absolute', bottom: 0, right: 0,
  width: widthPct + '%',
  height: 320,
  background: 'var(--paper)',
  borderTop: '1.6px solid var(--line)',
  borderLeft: '1.6px solid var(--line)',
  borderTopLeftRadius: 8,
  display: 'flex', flexDirection: 'column',
  boxShadow: '-8px -2px 18px rgba(28,27,26,0.06)',
  zIndex: 5
}}>
    {/* Resize handles */}
    {/* Left edge — horizontal resize */}
    <div style={{
    position: 'absolute', left: -4, top: 24, bottom: 8, width: 8,
    cursor: 'ew-resize', zIndex: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  }}>
      <span style={{
      width: 3, height: 28,
      background: 'var(--ink-faint)', opacity: .5,
      borderRadius: 2
    }} />
    </div>
    {/* Top edge — vertical resize */}
    <div style={{
    position: 'absolute', top: -4, left: 80, right: 80, height: 8,
    cursor: 'ns-resize', zIndex: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  }}>
      <span style={{
      height: 3, width: 36,
      background: 'var(--ink-faint)', opacity: .5,
      borderRadius: 2
    }} />
    </div>

    {/* Header — tabs + window controls */}
    <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 12px',
    borderBottom: '1.2px solid var(--line)',
    background: 'var(--paper-2)',
    borderTopLeftRadius: 8
  }}>
      <span style={{ fontSize: 13 }}>💬</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <ChatTab label="채팅" active={tab === 'chat'} />
        <ChatTab label="포커스 팔로잉" active={tab === 'focus'} live />
        <ChatTab label="파일" active={tab === 'files'} count="·3" />
      </div>
      <span style={{ flex: 1 }} />
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>─</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>⇲</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>×</span>
    </div>

    {/* Body */}
    {tab === 'chat' && <ChatTabPane />}
    {tab === 'files' && <FileTabPane />}
    {tab === 'focus' && <FocusTabPane />}

    {/* Input — only chat */}
    {tab === 'chat' &&
  <div style={{ padding: '8px 12px 10px', borderTop: '1.2px solid var(--line)' }}>
        <div className="sk wobble-1" style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 9px',
      background: 'var(--paper-2)'
    }}>
          <span style={{ fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--ink-faint)', flex: 1 }}>
            메시지 또는 파일 드래그…
          </span>
          <span style={{ fontSize: 13 }}>📎</span>
          <span style={{
        background: 'var(--sky)', color: '#fff',
        padding: '1px 10px', borderRadius: 999,
        fontFamily: 'var(--hand)', fontSize: 12, fontWeight: 700
      }}>↵</span>
        </div>
      </div>
  }
  </div>;


// V4 — Chat panel docked: 50% width, bottom-right of editor column, resizable.
const VariantChatDrawer = ({ tab = 'chat' }) => {
  const tabLabel = { chat: '채팅', focus: '포커스 팔로잉', files: '파일' }[tab];
  const tabNote = {
    chat: '에디터 좌측은 그대로 보이고, 채팅은 우하단에 ¼\u200b 영역만 점유',
    focus: '발표 시작·합류·로그를 한 곳에서. 진입점은 더 이상 navbar가 아님',
    files: '채팅에서 공유된 파일이 자동 누적 · 타입 필터 + 최신순'
  }[tab];
  return (
    <div className="shell">
      <TitleBar
        activeIdx={0}
        tabs={[
        { name: 'Capde Draft' },
        { name: 'API 명세서' },
        { name: '회의록 05-25' }]
        } />
      
      <TopNavbar
        breadcrumb={['초안', 'Capde Draft']}
        avatars={[
        { initials: 'M', tone: 'sky', you: true },
        { initials: 'J', tone: 'yel' },
        { initials: 'S', tone: 'pnk' }]
        } />
      
      <div className="row" style={{ flex: '1 1 auto', minHeight: 0 }}>
        <LeftSidebarExpanded />
        <div className="grow" style={{ position: 'relative', overflow: 'hidden', background: 'var(--paper)' }}>
          <EditorBody />
          <FloatingTOC active={1} />
          <ChatPanelDocked tab={tab} widthPct={50} />
          {/* Designer's note callout */}
          <div style={{
            position: 'absolute', top: 12, left: 16,
            background: 'var(--warm-yellow)',
            border: '1.2px solid var(--line)',
            borderRadius: 6,
            padding: '4px 10px',
            fontFamily: 'var(--hand-tight)', fontSize: 14,
            color: 'var(--ink)',
            boxShadow: '2px 2px 0 rgba(28,27,26,0.12)',
            transform: 'rotate(-1.2deg)',
            maxWidth: 280,
            lineHeight: 1.2,
            zIndex: 20
          }}>
            ✏️ <strong>{tabLabel}</strong> 탭<br />
            {tabNote}
          </div>
        </div>
      </div>
      <BottomStatusBar chatOpen />
    </div>);

};

// ============================================================
// Comparison — chat docking patterns
// ============================================================
const MiniShell = ({ children, w, h }) =>
<div style={{
  width: w, height: h,
  background: 'var(--paper)',
  border: '1.6px solid var(--line)',
  borderRadius: 8,
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: 'var(--hand)'
}}>{children}</div>;


const MiniHeader = () =>
<>
    <div style={{ height: 16, background: 'var(--paper-2)', borderBottom: '1.2px solid var(--line)', display: 'flex', alignItems: 'flex-end', gap: 3, padding: '0 6px 0 8px' }}>
      <div style={{ background: 'var(--paper)', borderTop: '1.2px solid var(--line)', borderLeft: '1.2px solid var(--line)', borderRight: '1.2px solid var(--line)', borderRadius: '4px 4px 0 0', height: 13, padding: '0 8px', fontSize: 9, fontWeight: 700, lineHeight: '13px' }}>Capde Draft</div>
      <div style={{ color: 'var(--ink-faint)', fontSize: 9, padding: '0 6px', lineHeight: '14px' }}>API</div>
    </div>
    <div style={{ height: 18, borderBottom: '1.2px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', fontSize: 10 }}>
      <span style={{ color: 'var(--ink-faint)' }}>← →</span>
      <span>초안 / <strong>Capde Draft</strong></span>
      <span style={{ flex: 1 }} />
      <span style={{ display: 'flex' }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--sky-soft)', border: '1px solid var(--line)' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--warm-yellow)', border: '1px solid var(--line)', marginLeft: -3 }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--pink)', border: '1px solid var(--line)', marginLeft: -3 }} />
      </span>
    </div>
  </>;


const MiniSidebar = ({ h, dimmed = false }) =>
<div style={{
  width: 90, flex: '0 0 auto',
  borderRight: '1.2px solid var(--line)',
  background: 'var(--paper)',
  padding: '8px 6px',
  display: 'flex', flexDirection: 'column', gap: 4,
  opacity: dimmed ? 0.45 : 1,
  position: 'relative'
}}>
    <div style={{ fontWeight: 700, fontSize: 10 }}>워크스페이스</div>
    <div style={{ height: 1, background: 'var(--ink-faint)', opacity: .3, margin: '2px 0' }} />
    <div style={{ fontSize: 9 }}>📁 초안</div>
    <div style={{ fontSize: 9, background: 'var(--sky-soft)', borderRadius: 3, padding: '1px 4px', fontWeight: 700 }}>📄 Capde</div>
    <div style={{ fontSize: 9, paddingLeft: 6 }}>📄 API</div>
    <div style={{ fontSize: 9 }}>📁 회의록</div>
    <div style={{ fontSize: 9, paddingLeft: 6 }}>📄 05-25</div>
    <div style={{ fontSize: 9 }}>📁 리서치</div>
    {dimmed &&
  <div style={{
    position: 'absolute', inset: 0,
    background: 'repeating-linear-gradient(135deg, rgba(220,38,38,.18) 0 2px, transparent 2px 8px)'
  }} />
  }
  </div>;


const MiniEditor = ({ short = false }) =>
<div style={{ flex: 1, padding: '8px 12px', background: 'var(--paper)', minWidth: 0, overflow: 'hidden' }}>
    <div style={{ height: 9, width: '55%', background: 'var(--ink)', opacity: .8, borderRadius: 2, marginBottom: 6 }} />
    <div style={{ height: 5, width: '90%', background: 'var(--ink-soft)', opacity: .4, borderRadius: 2, marginBottom: 3 }} />
    <div style={{ height: 5, width: '82%', background: 'var(--ink-soft)', opacity: .4, borderRadius: 2, marginBottom: 3 }} />
    <div style={{ height: 5, width: '78%', background: 'var(--ink-soft)', opacity: .4, borderRadius: 2, marginBottom: 10 }} />
    <div style={{ height: 8, width: '40%', background: 'var(--ink)', opacity: .7, borderRadius: 2, marginBottom: 5 }} />
    <div style={{ height: 5, width: '88%', background: 'var(--ink-soft)', opacity: .4, borderRadius: 2, marginBottom: 3 }} />
    {!short && <div style={{ height: 5, width: '74%', background: 'var(--ink-soft)', opacity: .4, borderRadius: 2, marginBottom: 3 }} />}
    {!short && <div style={{ height: 5, width: '80%', background: 'var(--ink-soft)', opacity: .4, borderRadius: 2, marginBottom: 3 }} />}
  </div>;


const MiniChat = ({ label = '💬 채팅 drawer' }) =>
<div style={{
  flex: '0 0 auto', height: 80,
  background: 'var(--paper-2)',
  borderTop: '1.4px solid var(--line)',
  padding: '5px 10px',
  fontSize: 10
}}>
    <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3 }}>
      <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--warm-yellow)', border: '1px solid var(--line)' }} />
      <span style={{ height: 4, flex: 1, background: 'var(--ink-soft)', opacity: .4, borderRadius: 2, maxWidth: 140 }} />
    </div>
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3 }}>
      <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--pink)', border: '1px solid var(--line)' }} />
      <span style={{ height: 4, flex: 1, background: 'var(--ink-soft)', opacity: .4, borderRadius: 2, maxWidth: 90 }} />
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 4, padding: '2px 5px' }}>
      <span style={{ color: 'var(--ink-faint)', fontSize: 9 }}>메시지…</span>
      <span style={{ flex: 1 }} />
      <span style={{ background: 'var(--sky)', color: '#fff', padding: '0 5px', borderRadius: 999, fontSize: 9, fontWeight: 700 }}>↵</span>
    </div>
  </div>;


const MiniStatus = () =>
<div style={{ height: 14, borderTop: '1.2px solid var(--line)', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 9, color: 'var(--ink-soft)', gap: 6 }}>
    <span style={{ color: 'var(--sky-deep)' }}>●</span>
    <span>LAN — 4명</span>
    <span style={{ flex: 1 }} />
    <span style={{ background: 'var(--sky-soft)', border: '1px solid var(--line)', padding: '0 6px', borderRadius: 999 }}>💬</span>
  </div>;


const ProsCons = ({ pros = [], cons = [] }) =>
<div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--hand)', fontSize: 13 }}>
    {pros.map((p, i) =>
  <div key={'p' + i} style={{ display: 'flex', gap: 6, color: 'var(--ink)' }}>
        <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
        <span>{p}</span>
      </div>
  )}
    {cons.map((c, i) =>
  <div key={'c' + i} style={{ display: 'flex', gap: 6, color: 'var(--ink-soft)' }}>
        <span style={{ color: '#dc2626', fontWeight: 700 }}>✗</span>
        <span>{c}</span>
      </div>
  )}
  </div>;


const DockingComparison = () => {
  const w = 360,h = 230;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--paper-2)',
      padding: '24px 28px 28px',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--hand)',
      overflow: 'hidden'
    }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>채팅탭 위치 - B로 결정</div>
        <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 2 }}>
          채팅을 하단에서 올릴 때 사이드바를 가로지를지(A), 우하단에 50%만 차지하고 resize할지(B), 우측 패널로 갈지(C) 비교 — B 채택.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, flex: 1, minHeight: 0 }}>
        {/* Option A: Full-width */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div>
            <span className="tag" style={{ background: '#fee2e2', fontWeight: 700, fontSize: 12 }}>A · 전체 너비</span>
            <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--ink-soft)' }}>Slack 방식</span>
          </div>
          <MiniShell w={w} h={h}>
            <MiniHeader />
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              <MiniSidebar dimmed />
              <MiniEditor short />
            </div>
            <MiniChat />
            <MiniStatus />
          </MiniShell>
          <ProsCons
            pros={['익숙한 패턴']}
            cons={[
            '사이드바 컬럼이 가로로 잘림',
            '페이지 점프 시 시선 이동 큼',
            '시각 무게가 하단에 쏠림']
            } />
          
        </div>

        {/* Option B: Editor column only (RECOMMENDED) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, position: 'relative' }}>
          <div>
            <span className="tag" style={{ background: 'var(--green)', fontWeight: 700, fontSize: 12 }}>B · 우하단 50% (resize) ★</span>
            <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--ink-soft)' }}>3-tab 채팅 패널</span>
          </div>
          <MiniShell w={w} h={h}>
            <MiniHeader />
            <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
              <MiniSidebar />
              <div style={{ flex: 1, position: 'relative', minWidth: 0, overflow: 'hidden' }}>
                <MiniEditor />
                {/* Bottom-right 50% chat panel with tabs */}
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: '52%', height: '52%',
                  background: 'var(--paper)',
                  borderTop: '1.4px solid var(--line)',
                  borderLeft: '1.4px solid var(--line)',
                  borderTopLeftRadius: 6,
                  display: 'flex', flexDirection: 'column',
                  boxShadow: '-3px -1px 6px rgba(28,27,26,0.06)'
                }}>
                  {/* Tabs */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    padding: '3px 6px',
                    borderBottom: '1px solid var(--line)',
                    background: 'var(--paper-2)',
                    fontSize: 8
                  }}>
                    <span style={{ padding: '1px 4px', background: 'var(--sky-soft)', borderRadius: 6, fontWeight: 700, border: '1px solid var(--sky-deep)' }}>채팅</span>
                    <span style={{ padding: '1px 4px', display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--ink-soft)' }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--sky-deep)' }} />
                      팔로잉
                    </span>
                    <span style={{ padding: '1px 4px', color: 'var(--ink-soft)' }}>파일</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ color: 'var(--ink-faint)' }}>⇲</span>
                  </div>
                  {/* mini msgs */}
                  <div style={{ flex: 1, padding: '3px 6px', display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0 }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--warm-yellow)', border: '1px solid var(--line)' }} />
                      <span style={{ height: 3, flex: 1, background: 'var(--ink-soft)', opacity: .4, borderRadius: 2, maxWidth: 80 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--pink)', border: '1px solid var(--line)' }} />
                      <span style={{ height: 3, flex: 1, background: 'var(--ink-soft)', opacity: .4, borderRadius: 2, maxWidth: 50 }} />
                    </div>
                  </div>
                </div>
                {/* Resize handle indicator on left edge of chat */}
                <div style={{
                  position: 'absolute', left: '48%', bottom: 0, width: 3, height: '50%',
                  background: 'var(--sky-deep)', opacity: .6,
                  cursor: 'ew-resize'
                }} />
              </div>
            </div>
            <MiniStatus />
          </MiniShell>
          <ProsCons
            pros={[
            '에디터 좌측·상단이 그대로 노출',
            '사이드바 컬럼 연속 + 페이지 점프 자유',
            'resize로 너비/높이 자유 조절',
            '3개 탭(채팅 · 팔로잉 · 파일) 통합']
            }
            cons={['우하단 영역은 가려짐']} />
          
          {/* Decision badge */}
          <div style={{
            position: 'absolute', top: -6, right: -10,
            transform: 'rotate(8deg)',
            background: 'var(--sky)', color: '#fff',
            border: '1.6px solid var(--sky-deep)',
            borderRadius: 6,
            padding: '4px 10px',
            fontFamily: 'var(--hand-tight)', fontSize: 14, fontWeight: 700,
            boxShadow: '2px 2px 0 rgba(28,27,26,0.18)',
            letterSpacing: '.02em'
          }}>결정 ✓</div>
        </div>

        {/* Option C: Right-side drawer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div>
            <span className="tag" style={{ background: '#e0e7ff', fontWeight: 700, fontSize: 12 }}>C · 우측 패널</span>
            <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--ink-soft)' }}>IDE inspector 방식</span>
          </div>
          <MiniShell w={w} h={h}>
            <MiniHeader />
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              <MiniSidebar />
              <MiniEditor />
              <div style={{
                width: 110, flex: '0 0 auto',
                borderLeft: '1.4px solid var(--line)',
                background: 'var(--paper-2)',
                padding: '5px 8px',
                fontSize: 10
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>💬 채팅</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--warm-yellow)', border: '1px solid var(--line)' }} />
                  <span style={{ height: 4, flex: 1, background: 'var(--ink-soft)', opacity: .4, borderRadius: 2 }} />
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--pink)', border: '1px solid var(--line)' }} />
                  <span style={{ height: 4, flex: 1, background: 'var(--ink-soft)', opacity: .4, borderRadius: 2 }} />
                </div>
              </div>
            </div>
            <MiniStatus />
          </MiniShell>
          <ProsCons
            pros={['세로형 메시지에 자연스러움', '에디터 높이 보존']}
            cons={[
            'TOC 자리와 충돌',
            '명세의 "하단 drawer 기본"과 다름']
            } />
          
        </div>
      </div>

      {/* Bottom callout — applied direction */}
      <div style={{
        marginTop: 16, padding: '10px 14px',
        background: 'var(--paper)',
        border: '1.4px solid var(--line)',
        borderRadius: 8,
        fontFamily: 'var(--hand)', fontSize: 14,
        color: 'var(--ink)',
        display: 'flex', alignItems: 'center', gap: 12
      }}>
        <span style={{
          background: 'var(--sky)', color: '#fff',
          padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 12
        }}>결정</span>
        <span>
          <strong>B · 우하단 50% drawer (resize 가능)</strong> 채택 — 에디터 좌·상단이 가려지지 않고,
          채팅·포커스 팔로잉·파일이 한 패널 3개 탭에 모인다. Floating(V2)으로 떼어내기도 그대로 지원.
        </span>
      </div>
    </div>);

};

Object.assign(window, { MiniShell, DockingComparison });



// ============================================================
// Editor body — Live Preview + 블록 인터랙션
// ============================================================

// ----- atoms -----
const MdSyntax = ({ children }) =>
<span style={{ color: 'var(--ink-faint)', fontWeight: 400, fontFamily: 'var(--mono)' }}>{children}</span>;

const InlineCode = ({ children }) =>
<span style={{
  fontFamily: 'var(--mono)', fontSize: '0.88em',
  background: 'var(--paper-2)', padding: '1px 5px', borderRadius: 3,
  border: '1px solid rgba(28,27,26,0.08)'
}}>{children}</span>;

const InlineLink = ({ children }) =>
<span style={{ color: 'var(--sky-deep)', textDecoration: 'underline', textUnderlineOffset: 2 }}>{children}</span>;

const CursorMark = ({ h = 18 }) =>
<span aria-hidden style={{
  display: 'inline-block', width: 1.8, height: h,
  background: 'var(--sky-deep)', verticalAlign: 'text-bottom',
  marginLeft: 1, marginRight: -1.8,
  animation: 'edcblink 1.06s steps(1) infinite'
}} />;

if (typeof document !== 'undefined' && !document.getElementById('ed-detail-styles')) {
  const s = document.createElement('style');
  s.id = 'ed-detail-styles';
  s.textContent = '@keyframes edcblink{50%{opacity:0}}';
  document.head.appendChild(s);
}

const Gutter = ({ visible = false }) =>
<div style={{
  width: 44, flex: '0 0 auto',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
  gap: 2, paddingTop: 4, paddingRight: 4,
  opacity: visible ? 1 : 0,
  color: 'var(--ink-faint)',
  userSelect: 'none'
}}>
    <span title="새 블록" style={{
    width: 20, height: 20,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 4, cursor: 'pointer',
    fontSize: 14, lineHeight: 1, fontWeight: 500
  }}>＋</span>
    <span title="드래그·우클릭" style={{
    width: 20, height: 20,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 4, cursor: 'grab',
    fontSize: 14, lineHeight: 1, fontWeight: 700
  }}>⠿</span>
  </div>;


const EdRow = ({ children, hovered = false, focused = false, selected = false, dimmed = false }) =>
<div style={{
  display: 'flex', gap: 0, alignItems: 'stretch',
  background: selected ? 'var(--sky-soft)' : hovered ? 'rgba(28,27,26,0.035)' : 'transparent',
  borderRadius: 4,
  margin: '1px 0',
  position: 'relative',
  opacity: dimmed ? 0.55 : 1
}}>
    <Gutter visible={hovered || selected || focused} />
    <div style={{
    flex: '1 1 auto', minWidth: 0,
    padding: '2px 8px',
    boxShadow: focused ? 'inset 2px 0 0 var(--sky-deep)' : 'none',
    borderRadius: 4, color: "rgb(0, 0, 0)"
  }}>{children}</div>
  </div>;


const H2 = ({ raw, children, focused }) =>
<div style={{ fontWeight: 700, fontSize: 22, lineHeight: 1.3, color: "rgb(0, 0, 0)" }}>
    {raw && <MdSyntax>## </MdSyntax>}
    {children}
    {focused && <CursorMark h={22} />}
  </div>;

const H3 = ({ raw, children, focused }) =>
<div style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.35 }}>
    {raw && <MdSyntax>### </MdSyntax>}
    {children}
    {focused && <CursorMark h={18} />}
  </div>;

const Para = ({ children, focused }) =>
<div style={{ fontSize: 14.5, lineHeight: 1.6 }}>
    {children}
    {focused && <CursorMark h={17} />}
  </div>;

const Quote = ({ raw, children }) =>
<div style={{
  display: 'flex', gap: 8,
  fontSize: 14, color: 'var(--ink-soft)',
  fontStyle: raw ? 'normal' : 'italic'
}}>
    {raw ? <MdSyntax>{'> '}</MdSyntax> :
  <span style={{ width: 3, background: 'var(--sky-deep)', borderRadius: 2, flex: '0 0 auto' }} />
  }
    <span style={{ flex: 1 }}>{children}</span>
  </div>;

const Bullet = ({ raw, children, focused }) =>
<div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 14.5, lineHeight: 1.6 }}>
    {raw ? <MdSyntax>- </MdSyntax> : <span style={{
    display: 'inline-block', width: 5, height: 5,
    background: 'var(--ink-soft)', borderRadius: '50%',
    marginTop: 8, flex: '0 0 auto'
  }} />}
    <span style={{ flex: 1 }}>
      {children}
      {focused && <CursorMark h={17} />}
    </span>
  </div>;


const PageTitle = ({ children }) =>
<div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 30, fontWeight: 700, marginTop: 4, color: "rgb(11, 11, 11)" }}>{children}</div>
  </div>;


const EditorFrame = ({ children, note, footerNote }) =>
<div style={{
  width: '100%', height: '100%',
  background: 'var(--paper)',
  border: '1.6px solid var(--line)',
  borderRadius: 8,
  overflow: 'hidden',
  display: 'flex', flexDirection: 'column',
  position: 'relative'
}}>
    {/* Mini top strip — breadcrumb + avatars */}
    <div style={{
    display: 'flex', alignItems: 'center',
    padding: '7px 14px',
    borderBottom: '1.4px solid var(--line)',
    background: 'var(--paper-2)',
    fontSize: 12, color: 'var(--ink-soft)',
    gap: 10,
    flex: '0 0 auto'
  }}>
      <span style={{ color: 'var(--ink-faint)' }}>← →</span>
      <span style={{ flex: 1 }}>초안 / <strong style={{ color: 'var(--ink)' }}>Capde Draft</strong></span>
      <span style={{ display: 'flex' }}>
        <Avatar initials="M" tone="sky" size={18} ring />
        <span style={{ marginLeft: -4 }}><Avatar initials="J" tone="yel" size={18} /></span>
        <span style={{ marginLeft: -4 }}><Avatar initials="S" tone="pnk" size={18} /></span>
      </span>
    </div>
    {/* Body row: collapsed sidebar + editor area */}
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* Mini collapsed sidebar — icon-rail only */}
      <div style={{
      width: 38, flex: '0 0 auto',
      borderRight: '1.4px solid var(--line)',
      background: 'var(--paper-2)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 6, padding: '8px 0',
      color: 'var(--ink-soft)',
      fontSize: 13
    }}>
        <span title="펼치기" style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>»</span>
        <span title="검색" style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>🔍</span>
        <div style={{ width: 18, height: 1, background: 'var(--ink-faint)', opacity: .35, margin: '2px 0' }} />
        <span style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>📁</span>
        <span style={{
        width: 24, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--sky-soft)', border: '1.2px solid var(--sky-deep)', borderRadius: 4
      }}>📄</span>
        <span style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>📄</span>
        <span style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>📄</span>
      </div>
      {/* Editor scroll area */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '24px 64px 24px 32px', position: 'relative' }}>
        <PageTitle><span style={{ color: 'rgb(0, 0, 0)' }}>Heading 1 Block</span></PageTitle>
        {children}
      </div>
    </div>
    {/* Bottom status bar */}
    <div style={{
    display: 'flex', alignItems: 'center',
    padding: '4px 12px',
    borderTop: '1.4px solid var(--line)',
    background: 'var(--paper-2)',
    height: 24, flex: '0 0 auto',
    fontSize: 12, color: 'var(--ink-soft)',
    gap: 10
  }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: 'var(--sky-deep)' }}>●</span>
        <span>📡 LAN — 4명 연결됨</span>
      </span>
      <span style={{ color: 'var(--ink-faint)' }}>·</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>192.168.4.31</span>
      <span style={{ flex: 1 }} />
      <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '1px 8px',
      border: '1.2px solid var(--line)',
      borderRadius: 999,
      background: 'var(--paper)',
      fontSize: 11
    }}>💬 채팅</span>
    </div>
    {note &&
  <div style={{
    position: 'absolute', top: 50, right: 16,
    background: 'var(--warm-yellow)',
    border: '1.2px solid var(--line)',
    borderRadius: 6,
    padding: '5px 9px',
    fontSize: 12,
    color: 'var(--ink)',
    boxShadow: '2px 2px 0 rgba(28,27,26,0.12)',
    transform: 'rotate(-0.6deg)',
    maxWidth: 240,
    lineHeight: 1.3,
    zIndex: 20
  }}>
        {note}
      </div>
  }
    {footerNote &&
  <div style={{
    padding: '4px 14px',
    borderTop: '1px dashed var(--ink-faint)',
    fontFamily: 'var(--mono)', fontSize: 10,
    color: 'var(--ink-faint)',
    letterSpacing: '.04em',
    background: 'var(--paper-2)',
    flex: '0 0 auto'
  }}>{footerNote}</div>
  }
  </div>;


const SampleHeadingText = <span style={{ color: 'rgb(0, 0, 0)' }}>Heading 2 Block</span>;
const SamplePara =
<>같은 subnet 안에서 <strong>여러 명이 동시에</strong> 같은 문서를 편집할 수 있습니다.</>;

const SampleParaRaw =
<>같은 subnet 안에서 <MdSyntax>**</MdSyntax>여러 명이 동시에<MdSyntax>**</MdSyntax> 같은 문서를 편집할 수 있습니다.</>;

const SampleParaLink =
<>Paragraph block with <InlineLink>link</InlineLink> and <InlineCode>inline code</InlineCode>.</>;

const SampleParaLinkRaw =
<>Paragraph block with <MdSyntax>[</MdSyntax>link<MdSyntax>](url)</MdSyntax> and <MdSyntax>`</MdSyntax>inline code<MdSyntax>`</MdSyntax>.</>;


const EditorAB1 = () =>
<EditorFrame
  note={<><strong>렌더링 모드 (기본)</strong><br />커서 없는 블록은 모두 렌더링된 상태. 노이즈가 없다.</>}
  footerNote="HOVER → 핸들 노출 · CLICK → Live Preview · RIGHT-CLICK → 컨텍스트 메뉴">
  
    <EdRow><H2>{SampleHeadingText}</H2></EdRow>
    <EdRow><Para>{SamplePara}</Para></EdRow>
    <EdRow><Para>{SampleParaLink}</Para></EdRow>
    <div style={{ height: 6 }} />
    <EdRow><H3>Heading 3 Block</H3></EdRow>
    <EdRow><Quote>Quote (blockquote) block</Quote></EdRow>
    <EdRow><Bullet>Bullet list item</Bullet></EdRow>
    <EdRow><Bullet>Bullet list item with link</Bullet></EdRow>
  </EditorFrame>;


const EditorAB2 = () =>
<EditorFrame
  note={<><strong>블록 호버</strong><br />왼쪽 거터에 ＋ (새 블록) · ⠿ (드래그·우클릭) 핸들 노출. 행 자체에 옅은 음영.</>}>
  
    <EdRow><H2>{SampleHeadingText}</H2></EdRow>
    <EdRow hovered><Para>{SamplePara}</Para></EdRow>
    <EdRow><Para>{SampleParaLink}</Para></EdRow>
    <EdRow><H3>Heading 3 Block</H3></EdRow>
    <EdRow><Quote>Quote (blockquote) block</Quote></EdRow>
    <EdRow><Bullet>Bullet list item</Bullet></EdRow>
    <EdRow><Bullet>Bullet list item with link</Bullet></EdRow>
    <div style={{ position: 'absolute', top: 152, left: 30, fontSize: 18, transform: 'rotate(-20deg)' }}>🖱</div>
  </EditorFrame>;


const EditorAB3 = () =>
<EditorFrame
  note={<><strong>커서 in 헤딩</strong><br />해당 블록만 raw 마크다운 노출 (<span style={{ fontFamily: 'var(--mono)' }}>## </span>). 다른 블록은 렌더링 유지.</>}>
  
    <EdRow focused><H2 raw focused>{SampleHeadingText}</H2></EdRow>
    <EdRow><Para>{SamplePara}</Para></EdRow>
    <EdRow><Para>{SampleParaLink}</Para></EdRow>
    <EdRow><H3>Heading 3 Block</H3></EdRow>
    <EdRow><Quote>Quote (blockquote) block</Quote></EdRow>
    <EdRow><Bullet>Bullet list item</Bullet></EdRow>
  </EditorFrame>;


const EditorAB4 = () =>
<EditorFrame
  note={<><strong>커서 in 단락</strong><br /><span style={{ fontFamily: 'var(--mono)' }}>**</span> / <span style={{ fontFamily: 'var(--mono)' }}>[link]()</span> / <span style={{ fontFamily: 'var(--mono)' }}>`code`</span> 마크다운 문자가 흐릿하게 노출. 의미는 살아 있다.</>}>
  
    <EdRow><H2>{SampleHeadingText}</H2></EdRow>
    <EdRow focused><Para focused>{SampleParaRaw}</Para></EdRow>
    <EdRow focused><Para focused>{SampleParaLinkRaw}</Para></EdRow>
    <EdRow><H3>Heading 3 Block</H3></EdRow>
    <EdRow><Quote>Quote (blockquote) block</Quote></EdRow>
    <EdRow><Bullet>Bullet list item</Bullet></EdRow>
  </EditorFrame>;


const SlashItem = ({ icon, label, hint, active = false }) =>
<div style={{
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '6px 10px', borderRadius: 4,
  background: active ? 'var(--sky-soft)' : 'transparent',
  fontSize: 13,
  cursor: 'pointer',
  margin: '0 4px',
  border: active ? '1.2px solid var(--sky-deep)' : '1.2px solid transparent'
}}>
    <span style={{
    width: 28, height: 28, flex: '0 0 auto',
    border: '1.2px solid rgba(28,27,26,0.15)',
    borderRadius: 4,
    background: 'var(--paper)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700
  }}>{icon}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{hint}</div>
    </div>
  </div>;


const SlashMenu = ({ x = 200, y = 240 }) =>
<div style={{
  position: 'absolute', left: x, top: y,
  width: 290,
  background: 'var(--paper)',
  border: '1.4px solid var(--line)',
  borderRadius: 8,
  boxShadow: '0 14px 32px rgba(28,27,26,0.16), 0 2px 8px rgba(28,27,26,0.08)',
  zIndex: 30,
  overflow: 'hidden',
  fontSize: 13
}}>
    <div style={{
    padding: '6px 10px', borderBottom: '1px solid rgba(28,27,26,0.08)',
    fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-soft)',
    background: 'var(--paper-2)'
  }}>
      /<span style={{ color: 'var(--ink)' }}>heading</span>
      <span style={{ color: 'var(--ink-faint)', marginLeft: 8 }}>↑↓ 이동 · Enter 선택 · Esc 닫기</span>
    </div>
    <div style={{ padding: '6px 0' }}>
      <div style={{ padding: '4px 14px', fontSize: 10, color: 'var(--ink-faint)', fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>기본</div>
      <SlashItem icon="T" label="텍스트" hint="일반 단락" />
      <SlashItem icon="H1" label="헤딩 1" hint="# 큰 제목" active />
      <SlashItem icon="H2" label="헤딩 2" hint="## 중간 제목" />
      <SlashItem icon="H3" label="헤딩 3" hint="### 작은 제목" />
      <SlashItem icon="•" label="글머리 기호" hint="- 항목" />
      <SlashItem icon="☐" label="할 일" hint="- [ ] 체크박스" />
      <div style={{ padding: '4px 14px 2px', fontSize: 10, color: 'var(--ink-faint)', fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>미디어 · 코드</div>
      <SlashItem icon="❝" label="인용" hint="> 인용문" />
      <SlashItem icon="{}" label="코드 블록" hint="```lang" />
      <SlashItem icon="🖼" label="이미지" hint="!이미지 또는 드래그" />
      <SlashItem icon="📄" label="PDF" hint="첨부 → 인앱 뷰어" />
    </div>
  </div>;


const EditorAB5 = () =>
<EditorFrame
  note={<><strong>슬래시 메뉴</strong><br /><span style={{ fontFamily: 'var(--mono)' }}>/</span> 입력 → 블록 추가 메뉴. 텍스트 매칭으로 즉시 필터.</>}>
  
    <EdRow><H2>{SampleHeadingText}</H2></EdRow>
    <EdRow><Para>{SamplePara}</Para></EdRow>
    <EdRow focused>
      <Para focused>
        <MdSyntax>/heading</MdSyntax>
      </Para>
    </EdRow>
    <EdRow><H3>Heading 3 Block</H3></EdRow>
    <EdRow><Quote>Quote (blockquote) block</Quote></EdRow>
    <SlashMenu x={84} y={232} />
  </EditorFrame>;


const CtxItem = ({ icon, label, shortcut, highlight = false, hasChild = false, tbd = false, danger = false }) =>
<div style={{
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '6px 10px', margin: '0 4px',
  borderRadius: 4,
  background: highlight ? 'var(--sky-soft)' : 'transparent',
  fontSize: 13,
  cursor: 'pointer',
  border: highlight ? '1.2px solid var(--sky-deep)' : '1.2px solid transparent',
  color: danger ? '#b91c1c' : 'var(--ink)'
}}>
    <span style={{ width: 18, textAlign: 'center', flex: '0 0 auto', fontSize: 14 }}>{icon}</span>
    <span style={{ flex: 1 }}>
      {label}
      {tbd && <span style={{ marginLeft: 6, padding: '0 5px', borderRadius: 3, background: '#fee2e2', color: '#b91c1c', fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: '.04em' }}>TBD</span>}
      {highlight && <span style={{ marginLeft: 6, padding: '0 5px', borderRadius: 3, background: 'var(--sky)', color: '#fff', fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: '.04em' }}>RMF Block</span>}
    </span>
    {hasChild && <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>▸</span>}
    {shortcut &&
  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>{shortcut}</span>
  }
  </div>;


const ContextMenu = ({ x = 240, y = 168 }) =>
<div style={{
  position: 'absolute', left: x, top: y,
  width: 296,
  background: 'var(--paper)',
  border: '1.4px solid var(--line)',
  borderRadius: 8,
  boxShadow: '0 14px 32px rgba(28,27,26,0.18), 0 2px 8px rgba(28,27,26,0.08)',
  zIndex: 30,
  paddingTop: 6,
  paddingBottom: 4
}}>
    <div style={{ padding: '0 8px 6px' }}>
      <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 8px',
      background: 'var(--paper-2)',
      border: '1.4px solid var(--sky)',
      borderRadius: 5,
      fontSize: 12,
      color: 'var(--ink-faint)'
    }}>
        <span>🔍</span>
        <span>작업을 검색하세요</span>
      </div>
    </div>
    <div style={{ padding: '2px 14px 6px', fontSize: 10, color: 'var(--ink-faint)', fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>작업</div>
    <CtxItem icon="↻" label="전환" hasChild />
    <CtxItem icon="🎨" label="색" hasChild />
    <CtxItem icon="🔗" label="블록 링크 복사" shortcut="Alt+⇧+L" />
    <CtxItem icon="📋" label="복제" shortcut="Ctrl+D" />
    <CtxItem icon="↗" label="옮기기" shortcut="Ctrl+⇧+P" />
    <CtxItem icon="🪟" label="플로팅으로 띄우기" shortcut="Ctrl+⇧+F" highlight />
    <CtxItem icon="🗑" label="삭제" shortcut="Del" danger />
    <div style={{ height: 1, background: 'rgba(28,27,26,0.1)', margin: '4px 8px' }} />
    <CtxItem icon="💬" label="댓글" shortcut="Ctrl+⇧+M" tbd />
    <CtxItem icon="✎" label="편집 내용 제안" shortcut="Ctrl+⇧+Alt+X" />
    <div style={{
    marginTop: 6, padding: '6px 14px 2px',
    borderTop: '1px solid rgba(28,27,26,0.08)',
    fontSize: 11, color: 'var(--ink-faint)',
    fontFamily: 'var(--mono)', letterSpacing: '.02em'
  }}>
      <div>재훈 최종 편집</div>
      <div>오늘 오후 2:02</div>
    </div>
  </div>;


const EditorAB6 = () =>
<EditorFrame
  note={<><strong>블록 우클릭</strong><br />노션-식 메뉴. AI 항목 없음. <span style={{ color: 'var(--sky-deep)', fontWeight: 700 }}>플로팅으로 띄우기</span>가 우리 고유 기능으로 강조.</>}>
  
    <EdRow><H2>{SampleHeadingText}</H2></EdRow>
    <EdRow selected><Para>{SamplePara}</Para></EdRow>
    <EdRow><Para>{SampleParaLink}</Para></EdRow>
    <EdRow><H3>Heading 3 Block</H3></EdRow>
    <EdRow><Quote>Quote (blockquote) block</Quote></EdRow>
    <EdRow><Bullet>Bullet list item</Bullet></EdRow>
    <ContextMenu x={224} y={168} />
  </EditorFrame>;


const FloatedMirror = ({ x = 540, y = 132 }) =>
<div style={{
  position: 'absolute', left: x, top: y,
  width: 300, height: 160,
  background: 'var(--paper)',
  border: '1.6px solid var(--line)',
  borderRadius: 8,
  boxShadow: '0 14px 32px rgba(28,27,26,0.18), 0 2px 8px rgba(28,27,26,0.08)',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
  zIndex: 25
}}>
    <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 9px',
    borderBottom: '1.2px dashed var(--line)',
    background: 'var(--sky-soft)',
    fontSize: 11,
    color: 'var(--ink-soft)'
  }}>
      <span>🪟</span>
      <span style={{ flex: 1 }}>미러됨 — 단락 <span style={{ color: 'var(--sky-deep)', fontWeight: 700 }}>· 실시간</span></span>
      <span style={{ fontFamily: 'var(--mono)' }}>×</span>
    </div>
    <div style={{ padding: '10px 12px', fontSize: 13.5, lineHeight: 1.55 }}>
      같은 subnet 안에서 <strong>여러 명이 동시에</strong> 같은 문서를 편집할 수 있습니다.
    </div>
    <div style={{
    position: 'absolute', bottom: 2, right: 2,
    width: 10, height: 10,
    borderRight: '2px solid var(--ink-faint)',
    borderBottom: '2px solid var(--ink-faint)',
    opacity: .5,
    cursor: 'nwse-resize'
  }} />
  </div>;


const FloatArrow = () =>
<svg width="220" height="100" style={{ position: 'absolute', left: 269, top: 60, zIndex: 24, pointerEvents: 'none', transform: 'rotate(10deg)', transformOrigin: 'left center' }}>
    <defs>
      <marker id="ar-float" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L10,5 L0,10 z" fill="#0ea5e9" />
      </marker>
    </defs>
    <path d="M 8 50 Q 100 -10 200 18" stroke="#0ea5e9" strokeWidth="2" fill="none" strokeDasharray="3 3" markerEnd="url(#ar-float)" />
  </svg>;


const EditorAB7 = () =>
<EditorFrame
  note={<><strong>플로팅 트리거 직후</strong><br />원본은 자리에 남고, 미러된 창이 떠올라 페이지 이동·스크롤과 무관하게 유지. 개인 화면 전용.</>}>
  
    <EdRow><H2>{SampleHeadingText}</H2></EdRow>
    <EdRow dimmed><Para>{SamplePara}</Para></EdRow>
    <EdRow><Para>{SampleParaLink}</Para></EdRow>
    <EdRow><H3>Heading 3 Block</H3></EdRow>
    <EdRow><Quote>Quote (blockquote) block</Quote></EdRow>
    <EdRow><Bullet>Bullet list item</Bullet></EdRow>
    <EdRow><Bullet>Bullet list item with link</Bullet></EdRow>
    <FloatArrow />
    <FloatedMirror x={486} y={120} />
  </EditorFrame>;


// ----- Edge case: max reached (3/3) -----
const MiniMirror = ({ x, y, w = 184, h = 96, label, body }) =>
<div style={{
  position: 'absolute', left: x, top: y,
  width: w, height: h,
  background: 'var(--paper)',
  border: '1.4px solid var(--line)',
  borderRadius: 7,
  boxShadow: '0 10px 22px rgba(28,27,26,0.16), 0 1px 4px rgba(28,27,26,0.08)',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
  zIndex: 22
}}>
    <div style={{
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '3px 7px',
    borderBottom: '1px dashed var(--line)',
    background: 'var(--sky-soft)',
    fontSize: 10,
    color: 'var(--ink-soft)'
  }}>
      <span>🪟</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)' }}>×</span>
    </div>
    <div style={{ padding: '6px 8px', fontSize: 11.5, lineHeight: 1.45 }}>{body}</div>
  </div>;


// Disabled context-menu row with a side tooltip
const CtxItemDisabled = ({ icon, label, shortcut }) =>
<div style={{
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '6px 10px', margin: '0 4px',
  borderRadius: 4,
  background: 'transparent',
  fontSize: 13,
  cursor: 'not-allowed',
  color: 'var(--ink-faint)',
  opacity: 0.55,
  position: 'relative'
}}>
    <span style={{ width: 18, textAlign: 'center', flex: '0 0 auto', fontSize: 14 }}>{icon}</span>
    <span style={{ flex: 1, textDecoration: 'line-through' }}>{label}</span>
    <span style={{
    padding: '0 5px', borderRadius: 3,
    background: '#fee2e2', color: '#b91c1c',
    fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: '.04em'
  }}>3/3</span>
    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', textDecoration: 'line-through' }}>{shortcut}</span>
  </div>;


const ContextMenuMaxed = ({ x = 240, y = 168 }) =>
<div style={{
  position: 'absolute', left: x, top: y,
  width: 296,
  background: 'var(--paper)',
  border: '1.4px solid var(--line)',
  borderRadius: 8,
  boxShadow: '0 14px 32px rgba(28,27,26,0.18), 0 2px 8px rgba(28,27,26,0.08)',
  zIndex: 30,
  paddingTop: 6,
  paddingBottom: 4
}}>
    <div style={{ padding: '0 8px 6px' }}>
      <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 8px',
      background: 'var(--paper-2)',
      border: '1.2px solid rgba(28,27,26,0.15)',
      borderRadius: 5,
      fontSize: 12,
      color: 'var(--ink-faint)'
    }}>
        <span>🔍</span>
        <span>작업을 검색하세요</span>
      </div>
    </div>
    <div style={{ padding: '2px 14px 6px', fontSize: 10, color: 'var(--ink-faint)', fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>작업</div>
    <CtxItem icon="↻" label="전환" hasChild />
    <CtxItem icon="🎨" label="색" hasChild />
    <CtxItem icon="🔗" label="블록 링크 복사" shortcut="Alt+⇧+L" />
    <CtxItem icon="📋" label="복제" shortcut="Ctrl+D" />
    <CtxItem icon="↗" label="옮기기" shortcut="Ctrl+⇧+P" />
    {/* The disabled one */}
    <CtxItemDisabled icon="🪟" label="플로팅으로 띄우기" shortcut="Ctrl+⇧+F" />
    <CtxItem icon="🗑" label="삭제" shortcut="Del" danger />
    <div style={{ height: 1, background: 'rgba(28,27,26,0.1)', margin: '4px 8px' }} />
    <CtxItem icon="💬" label="댓글" shortcut="Ctrl+⇧+M" tbd />
    <CtxItem icon="✎" label="편집 내용 제안" shortcut="Ctrl+⇧+Alt+X" />
    <div style={{
    marginTop: 6, padding: '6px 14px 2px',
    borderTop: '1px solid rgba(28,27,26,0.08)',
    fontSize: 11, color: 'var(--ink-faint)',
    fontFamily: 'var(--mono)', letterSpacing: '.02em'
  }}>
      <div>재훈 최종 편집</div>
      <div>오늘 오후 2:02</div>
    </div>
  </div>;


// Tooltip pointing at the disabled row from the right
const MaxTooltip = ({ x, y }) =>
<div style={{
  position: 'absolute', left: x, top: y,
  background: 'var(--ink)', color: '#fff',
  fontSize: 11, lineHeight: 1.4,
  padding: '7px 10px', borderRadius: 6,
  boxShadow: '0 8px 18px rgba(28,27,26,0.22)',
  zIndex: 40,
  width: 200
}}>
    <div style={{ fontWeight: 700, marginBottom: 2 }}>플로팅 블록이 너무 많습니다</div>
    <div style={{ opacity: .8 }}>현재 <span style={{ fontFamily: 'var(--mono)' }}>3/3</span> · 기존 창을 닫고 다시 시도하세요</div>
    {/* tooltip arrow (pointing left to the menu item) */}
    <div style={{
    position: 'absolute', left: -5, top: 14,
    width: 0, height: 0,
    borderTop: '5px solid transparent',
    borderBottom: '5px solid transparent',
    borderRight: '5px solid var(--ink)'
  }} />
  </div>;


const EditorAB8 = () =>
<EditorFrame
  note={<><strong>최대 3개 도달</strong><br />플로팅 창이 이미 3개 떠 있으면, 우클릭 메뉴의 "플로팅으로 띄우기"가 disable + 호버 시 안내 툴팁.</>}>
  
    <EdRow><H2>{SampleHeadingText}</H2></EdRow>
    <EdRow selected><Para>{SamplePara}</Para></EdRow>
    <EdRow><Para>{SampleParaLink}</Para></EdRow>
    <EdRow><H3>Heading 3 Block</H3></EdRow>
    <EdRow><Quote>Quote (blockquote) block</Quote></EdRow>
    <EdRow><Bullet>Bullet list item</Bullet></EdRow>
    {/* Three existing floats — stacked top-right */}
    <MiniMirror x={420} y={48} label="제품 개요" body={<>같은 LAN, 같은 공간에서 동시 편집. 외부 클라우드 의존 없음.</>} />
    <MiniMirror x={470} y={160} label="네트워크 토폴로지" body={<><span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>topology.png</span> · 미러 이미지 영역</>} />
    <MiniMirror x={420} y={272} label="포커스 팔로잉 흐름" body={<>① 발표자 [📡] → 채팅 시스템 메시지 → [참여하기]</>} />
    {/* Context menu with disabled float item */}
    <ContextMenuMaxed x={148} y={172} />
    {/* Tooltip pointing at the disabled item */}
    <MaxTooltip x={450} y={336} />
    {/* Connector from tooltip to the disabled item */}
    <svg width="50" height="30" style={{ position: 'absolute', left: 408, top: 340, zIndex: 35, pointerEvents: 'none' }}>
      <path d="M 0 6 Q 22 6 42 6" stroke="rgba(28,27,26,0.4)" strokeWidth="1" fill="none" strokeDasharray="2 2" />
    </svg>
  </EditorFrame>;


// ----- Edge case: original deleted -----
const DeletedFloatMirror = ({ x, y }) =>
<div style={{
  position: 'absolute', left: x, top: y,
  width: 320, height: 170,
  background: 'var(--paper)',
  border: '1.6px solid #f59e0b',
  borderRadius: 8,
  boxShadow: '0 14px 32px rgba(28,27,26,0.18), 0 2px 8px rgba(28,27,26,0.08)',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
  zIndex: 25
}}>
    <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 9px',
    borderBottom: '1.2px dashed #f59e0b',
    background: '#fef3c7',
    fontSize: 11,
    color: 'var(--ink-soft)'
  }}>
      <span>🪟</span>
      <span style={{ flex: 1 }}>미러됨 · <span style={{ color: '#b45309', fontWeight: 700 }}>연결 끊김</span></span>
      <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink)', fontWeight: 700 }}>×</span>
    </div>
    {/* Greyed-out preview of last-known content */}
    <div style={{
    position: 'relative',
    padding: '10px 12px', fontSize: 13.5, lineHeight: 1.55,
    color: 'var(--ink-faint)',
    flex: 1,
    background:
    'repeating-linear-gradient(135deg, rgba(28,27,26,0.04) 0 1px, transparent 1px 8px), var(--paper)'
  }}>
      <span style={{ textDecoration: 'line-through' }}>
        같은 LAN 위에서, 여러 명이 동시에 같은 문서를 편집할 수 있다.
      </span>
      {/* Overlay alert message */}
      <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(254,243,199,0.78)',
      backdropFilter: 'blur(0.5px)'
    }}>
        <div style={{
        background: 'var(--paper)',
        border: '1.4px solid #f59e0b',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 12,
        color: 'var(--ink)',
        maxWidth: 260,
        textAlign: 'center',
        boxShadow: '0 4px 12px rgba(28,27,26,0.12)'
      }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ 원본이 삭제되었습니다</div>
          <div style={{ color: 'var(--ink-soft)', fontSize: 11, lineHeight: 1.5, marginBottom: 6 }}>
            <strong>재훈</strong>이 14:18에 이 블록을 삭제했어요.
          </div>
          <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 10px', borderRadius: 999,
          background: 'var(--ink)', color: '#fff',
          fontSize: 11, fontWeight: 700,
          cursor: 'pointer'
        }}>창 닫기</div>
        </div>
      </div>
    </div>
  </div>;


const EditorAB9 = () =>
<EditorFrame
  note={<><strong>원본 삭제됨</strong><br />다른 사용자가 원본 블록을 지우면 미러 창은 경고 상태로 전환. 닫기만 가능, 편집·복원 불가.</>}>
  
    <EdRow><H2>{SampleHeadingText}</H2></EdRow>
    {/* The original block is gone — show a subtle "삭제됨" marker in place */}
    <div style={{
    margin: '4px 6px 4px 50px',
    padding: '6px 10px',
    borderRadius: 4,
    background: '#fef3c7',
    border: '1px dashed #f59e0b',
    fontSize: 12,
    color: '#92400e',
    display: 'flex', alignItems: 'center', gap: 6
  }}>
      <span>⚠</span>
      <span><strong>재훈</strong>이 단락을 삭제했습니다 · 14:18</span>
    </div>
    <EdRow><Para>{SampleParaLink}</Para></EdRow>
    <EdRow><H3>Heading 3 Block</H3></EdRow>
    <EdRow><Quote>Quote (blockquote) block</Quote></EdRow>
    <EdRow><Bullet>Bullet list item</Bullet></EdRow>
    <EdRow><Bullet>Bullet list item with link</Bullet></EdRow>
    {/* The mirror in deleted state */}
    <DeletedFloatMirror x={470} y={120} />
  </EditorFrame>;


Object.assign(window, {
  EditorAB1, EditorAB2, EditorAB3, EditorAB4, EditorAB5, EditorAB6, EditorAB7,
  EditorAB8, EditorAB9
});


// ============================================================
// In-app File Viewer (UC-080) — 인앱 파일 뷰어
// PDF 임베드 블록 + 인라인 미리보기 + 미리보기 토글(⋮ 메뉴)
// ============================================================

// Small toolbar icon button used inside the embedded PDF viewer chrome.
const FvBtn = ({ children, title, active = false, caret = false }) =>
<span title={title} style={{
  height: 24, minWidth: 24,
  padding: caret ? '0 5px' : 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3,
  borderRadius: 5,
  border: active ? '1.2px solid var(--sky-deep)' : '1.2px solid transparent',
  background: active ? 'var(--sky-soft)' : 'transparent',
  color: active ? 'var(--sky-deep)' : 'var(--ink-soft)',
  fontSize: 13, lineHeight: 1, cursor: 'pointer', flex: '0 0 auto'
}}>{children}</span>;

const FvDivider = () =>
<span style={{ width: 1, height: 16, background: 'rgba(28,27,26,0.18)', margin: '0 3px', flex: '0 0 auto' }} />;

// The chrome bar above an embedded PDF — mirrors the reference toolbar.
const PdfViewerToolbar = ({ collapsed = false, menuOpen = false }) =>
<div style={{
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '5px 8px',
  borderBottom: '1.2px solid var(--line)',
  background: 'var(--paper-2)',
  position: 'relative'
}}>
    <FvBtn title="페이지 보기" caret>▤ <span style={{ fontSize: 9 }}>▾</span></FvBtn>
    <FvDivider />
    <FvBtn title="축소">－</FvBtn>
    <FvBtn title="확대" caret>＋ <span style={{ fontSize: 9 }}>▾</span></FvBtn>
    <FvDivider />
    <span style={{
    width: 34, height: 22,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: '1.2px solid var(--line)', borderRadius: 4,
    background: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)'
  }}>1</span>
    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-soft)' }}>/ 1</span>
    <span style={{ flex: 1 }} />
    {/* preview toggle lives inside the ⋮ menu — the button is highlighted when open */}
    <FvBtn title="더보기" active={menuOpen}>⋮</FvBtn>
    <FvBtn title="원본(코드) 보기" caret>&lt;/&gt;</FvBtn>

    {/* dropdown menu — preview toggle highlighted */}
    {menuOpen &&
  <div style={{
    position: 'absolute', top: 36, right: 6,
    width: 188,
    background: 'var(--paper)',
    border: '1.4px solid var(--line)',
    borderRadius: 7,
    boxShadow: '0 12px 28px rgba(28,27,26,0.18), 0 2px 6px rgba(28,27,26,0.08)',
    padding: 5, zIndex: 40,
    display: 'flex', flexDirection: 'column', gap: 1
  }}>
        <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 10px', borderRadius: 5,
      background: 'var(--sky-soft)', border: '1.2px solid var(--sky-deep)',
      fontSize: 13, fontWeight: 700, color: 'var(--sky-deep)'
    }}>
          <span style={{ width: 16, textAlign: 'center' }}>⊖</span>
          미리보기 접기
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 5, fontSize: 13, color: 'var(--ink)' }}>
          <span style={{ width: 16, textAlign: 'center' }}>↓</span> 다운로드
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 5, fontSize: 13, color: 'var(--ink)' }}>
          <span style={{ width: 16, textAlign: 'center' }}>⤢</span> 전체 화면
        </div>
        <div style={{ height: 1, background: 'rgba(28,27,26,0.12)', margin: '3px 6px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 5, fontSize: 13, color: 'var(--ink-soft)' }}>
          <span style={{ width: 16, textAlign: 'center' }}>🗑</span> 임베드 제거
        </div>
      </div>
  }
  </div>;

// A faux rendered PDF page (wireframe placeholders, reference-style boxed list).
const PdfPage = () =>
<div style={{
  background: '#fff',
  border: '1.2px solid var(--line)',
  borderRadius: 2,
  boxShadow: '0 2px 8px rgba(28,27,26,0.10)',
  margin: '16px auto',
  width: 320, padding: '22px 26px',
  display: 'flex', flexDirection: 'column', gap: 10
}}>
    <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-faint)', letterSpacing: '.02em' }}>
      LAN Protocol Spec v0.3 / 동현
    </div>
    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>3. 디스커버리 절차</div>
    {/* boxed spec list — like the grammar box in the reference */}
    <div style={{ alignSelf: 'center', border: '1.2px solid var(--ink)', borderRadius: 2, padding: '8px 12px', width: 'fit-content' }}>
      {[
    '1.  mDNS 질의 브로드캐스트',
    '2.  _localguard._tcp 응답 수집',
    '3.  피어 host / port 파싱',
    '4.  세션 키 교환 (X25519)',
    '5.  CRDT 문서 핸드셰이크',
    '6.  편집 스트림 구독'].
    map((t, i) =>
    <div key={i} style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink)', lineHeight: 1.55 }}>{t}</div>
    )}
    </div>
    {/* placeholder body lines */}
    {[92, 100, 78, 96, 64].map((w, i) =>
  <div key={i} style={{ height: 4, width: w + '%', background: 'var(--ink-soft)', opacity: .32, borderRadius: 2 }} />
  )}
    <div style={{ height: 6 }} />
    {[88, 70].map((w, i) =>
  <div key={i} style={{ height: 4, width: w + '%', background: 'var(--ink-soft)', opacity: .32, borderRadius: 2 }} />
  )}
  </div>;

// Embedded PDF block — wiki-link header + (optional) viewer chrome + page.
const PdfEmbedBlock = ({ collapsed = false, menuOpen = false }) =>
<div style={{ margin: '4px 0' }}>
    {/* wiki-style embed link line */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14.5, marginBottom: collapsed ? 0 : 8 }}>
      <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono)' }}>[[</span>
      <span style={{ color: 'var(--sky-deep)', textDecoration: 'underline', textUnderlineOffset: 2 }}>LAN-프로토콜-스펙.pdf</span>
      <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono)' }}>]]</span>
    </div>

    {collapsed ?
  // collapsed state — compact file chip with a "펼치기" affordance
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    border: '1.2px solid var(--line)', borderRadius: 6,
    background: 'var(--paper-2)', padding: '8px 12px', maxWidth: 360
  }}>
        <span style={{
      width: 30, height: 30, flex: '0 0 auto',
      border: '1.2px solid var(--line)', borderRadius: 5, background: 'var(--pink)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15
    }}>📄</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>LAN-프로토콜-스펙.pdf</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)' }}>PDF · 1.2 MB · 미리보기 접힘</div>
        </div>
        <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 999,
      border: '1.2px solid var(--sky-deep)', background: 'var(--sky-soft)',
      color: 'var(--sky-deep)', fontSize: 12, fontWeight: 700, cursor: 'pointer'
    }}>⊕ 미리보기 펼치기</span>
      </div> :
  // expanded state — inline PDF viewer
  <div style={{
    border: '1.4px solid var(--line)', borderRadius: 7,
    overflow: 'hidden', background: 'var(--paper)', maxWidth: 420
  }}>
        <PdfViewerToolbar menuOpen={menuOpen} />
        <div style={{ background: 'var(--paper-2)', padding: '0 4px' }}>
          <PdfPage />
        </div>
      </div>
  }
  </div>;

const SampleFileIntro =
<>아래 사양 문서는 채팅 대신 본문에 임베드해 두었습니다. 외부 뷰어 없이 바로 확인하세요.</>;

const FileViewerAB1 = () =>
<EditorFrame
  note={<><strong>미리보기 펼침 (기본)</strong><br />PDF 임베드 블록은 인앱 뷰어로 바로 렌더링. 외부 프로그램 전환 없음.</>}
  footerNote="CLICK 파일 블록 → 인앱 뷰어 · ⋮ → 미리보기 토글 · 지원: PDF · Word · PPT · Excel">
  
    <EdRow><H2><span style={{ color: 'rgb(0,0,0)' }}>디스커버리 프로토콜</span></H2></EdRow>
    <EdRow><Para>{SampleFileIntro}</Para></EdRow>
    <EdRow><PdfEmbedBlock /></EdRow>
  </EditorFrame>;

const FileViewerAB2 = () =>
<EditorFrame
  note={<><strong>⋮ 메뉴 — 미리보기 토글</strong><br />뷰어 우상단 ⋮ 메뉴에 <span style={{ color: 'var(--sky-deep)', fontWeight: 700 }}>미리보기 접기</span> 항목. 다운로드·전체 화면도 함께.</>}>
  
    <EdRow><H2><span style={{ color: 'rgb(0,0,0)' }}>디스커버리 프로토콜</span></H2></EdRow>
    <EdRow><Para>{SampleFileIntro}</Para></EdRow>
    <EdRow><PdfEmbedBlock menuOpen /></EdRow>
  </EditorFrame>;

const FileViewerAB3 = () =>
<EditorFrame
  note={<><strong>미리보기 접힘</strong><br />접으면 컴팩트 파일 칩으로 축소. <span style={{ color: 'var(--sky-deep)', fontWeight: 700 }}>미리보기 펼치기</span>로 다시 인앱 뷰어 복귀.</>}
  footerNote="문서가 길어질 때 본문 흐름을 해치지 않도록 임베드를 접어 둘 수 있다.">
  
    <EdRow><H2><span style={{ color: 'rgb(0,0,0)' }}>디스커버리 프로토콜</span></H2></EdRow>
    <EdRow><Para>{SampleFileIntro}</Para></EdRow>
    <EdRow><PdfEmbedBlock collapsed /></EdRow>
    <div style={{ height: 6 }} />
    <EdRow><H3>3. 디스커버리 절차</H3></EdRow>
    <EdRow><Para>본문이 이어집니다 — 임베드를 접으면 읽기 흐름이 끊기지 않습니다.</Para></EdRow>
  </EditorFrame>;

Object.assign(window, {
  FileViewerAB1, FileViewerAB2, FileViewerAB3
});


// ============================================================
// Focus Following — Presenter / Follower / Multi
// ============================================================

// Presenter top banner (different tone from follower)
const PresenterBanner = ({ followerCount = 3 }) =>
<div style={{
  position: 'absolute', top: 0, left: 0, right: 0,
  background: 'var(--sky-soft)',
  borderBottom: '1.6px solid var(--sky-deep)',
  padding: '6px 16px',
  display: 'flex', alignItems: 'center', gap: 10,
  fontSize: 13,
  zIndex: 4
}}>
    <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6
  }}>
      <span style={{
      width: 8, height: 8, borderRadius: '50%',
      background: 'var(--sky-deep)',
      boxShadow: '0 0 0 3px rgba(14,165,233,0.22)',
      animation: 'edcblink 1.6s steps(1) infinite'
    }} />
      <span style={{
      fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.06em',
      color: 'var(--sky-deep)', fontWeight: 700
    }}>LIVE · 04:21</span>
    </span>
    <span style={{ color: 'var(--ink-faint)' }}>·</span>
    <span>
      <strong>내가 공유 중</strong> — <strong>{followerCount}명</strong>이 따라보고 있어요
    </span>
    <span style={{ display: 'inline-flex', marginLeft: 4 }}>
      <Avatar initials="J" tone="yel" size={18} />
      <span style={{ marginLeft: -4 }}><Avatar initials="S" tone="pnk" size={18} /></span>
      <span style={{ marginLeft: -4 }}><Avatar initials="M" tone="sky" size={18} /></span>
    </span>
    <span style={{ flex: 1 }} />
    <span className="tag" style={{ background: 'var(--paper)', fontSize: 11 }}>✎ 펜 도구</span>
    <span className="tag" style={{
    background: 'var(--paper)',
    border: '1.2px solid #dc2626',
    color: '#b91c1c', fontWeight: 700, fontSize: 11
  }}>⏹ 공유 중단</span>
  </div>;


// Floating pen toolbar (presenter only)
const PenToolbar = ({ x = '50%', y = 'auto', bottom = 24 }) =>
<div style={{
  position: 'absolute',
  left: x, bottom,
  transform: x === '50%' ? 'translateX(-50%)' : 'none',
  background: 'var(--paper)',
  border: '1.4px solid var(--line)',
  borderRadius: 999,
  boxShadow: '0 12px 28px rgba(28,27,26,0.18), 0 2px 6px rgba(28,27,26,0.08)',
  padding: '5px 8px',
  display: 'flex', alignItems: 'center', gap: 4,
  zIndex: 35
}}>
    {/* Color swatches */}
    {[
  { c: '#0ea5e9', active: true },
  { c: '#f59e0b' },
  { c: '#ec4899' },
  { c: '#1c1b1a' }].
  map((s, i) =>
  <span key={i} style={{
    width: 18, height: 18, borderRadius: '50%',
    background: s.c,
    boxShadow: s.active ?
    '0 0 0 2px var(--paper), 0 0 0 3.4px ' + s.c :
    'inset 0 0 0 1.2px rgba(28,27,26,0.15)',
    cursor: 'pointer',
    flex: '0 0 auto'
  }} />
  )}
    <span style={{ width: 1, height: 18, background: 'rgba(28,27,26,0.15)', margin: '0 4px' }} />
    {/* Tools */}
    {[
  { ch: '✎', t: '펜', active: true },
  { ch: '▬', t: '형광펜' },
  { ch: '⎯', t: '밑줄' },
  { ch: '↗', t: '화살표' },
  { ch: '○', t: '원' },
  { ch: '⌫', t: '지우개' }].
  map((t, i) =>
  <span key={i} title={t.t} style={{
    width: 26, height: 26,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 5,
    background: t.active ? 'var(--sky-soft)' : 'transparent',
    border: t.active ? '1.2px solid var(--sky-deep)' : '1.2px solid transparent',
    fontSize: 14, fontWeight: 700,
    cursor: 'pointer',
    color: 'var(--ink)'
  }}>{t.ch}</span>
  )}
    <span style={{ width: 1, height: 18, background: 'rgba(28,27,26,0.15)', margin: '0 4px' }} />
    <span title="실행 취소" style={{
    width: 26, height: 26,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 5, fontSize: 13, cursor: 'pointer', color: 'var(--ink-soft)'
  }}>↺</span>
    <span style={{
    padding: '3px 9px', borderRadius: 999,
    fontSize: 11, color: 'var(--ink-soft)',
    cursor: 'pointer', fontFamily: 'var(--mono)', letterSpacing: '.04em',
    border: '1.2px solid rgba(28,27,26,0.15)'
  }}>CLEAR</span>
  </div>;


// Drawing marks SVG overlay — visible to both presenter & follower
const DrawingMarks = () =>
<svg style={{
  position: 'absolute', inset: 0, width: '100%', height: '100%',
  pointerEvents: 'none', zIndex: 16
}}>
    {/* Sky wavy underline */}
    <path
    d="M 322 240 Q 348 244 376 240 Q 404 236 432 242 Q 458 246 484 240"
    stroke="#0ea5e9" strokeWidth="2.6" fill="none" strokeLinecap="round" />
  
    {/* Amber underline */}
    <path
    d="M 256 296 Q 280 298 312 295"
    stroke="#f59e0b" strokeWidth="2.4" fill="none" strokeLinecap="round" />
  
    {/* Pink hand-drawn circle around a word */}
    <path
    d="M 244 382 q 0 -14 38 -14 q 38 0 38 14 q 0 14 -38 14 q -38 0 -38 -14 z"
    stroke="#ec4899" strokeWidth="2" fill="none" />
  
    {/* Sky arrow */}
    <g>
      <path d="M 380 432 Q 460 422 530 408" stroke="#0ea5e9" strokeWidth="2" fill="none" />
      <path d="M 522 400 L 534 408 L 522 416" stroke="#0ea5e9" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>;


// =============== Presenter view ===============
const VariantPresenter = () =>
<div className="shell">
    <TitleBar
    activeIdx={1}
    tabs={[
    { name: 'Capde Draft' },
    { name: 'API 명세서' }]
    } />
  
    <TopNavbar
    breadcrumb={['초안', 'API 명세서']}
    avatars={[
    { initials: 'M', tone: 'sky', you: true },
    { initials: 'J', tone: 'yel' },
    { initials: 'S', tone: 'pnk' },
    { initials: 'D', tone: 'grn' }]
    }
    focusActive />
  
    <div className="row grow" style={{ flex: '1 1 auto', minHeight: 0, position: 'relative' }}>
      <LeftSidebarExpanded active="API 명세서" />
      <div className="grow" style={{ position: 'relative', overflow: 'hidden', background: 'var(--paper)' }}>
        <PresenterBanner followerCount={3} />
        <div style={{ paddingTop: 30, height: '100%' }}>
          <EditorBody />
        </div>
        <DrawingMarks />
        <PenToolbar bottom={28} />
        <FloatingTOC active={2} />
      </div>
    </div>
    <BottomStatusBar />
  </div>;


// =============== Follower view (refined V3) ===============
// FollowerBanner — slightly different: amber-ish, with controls
const FollowerBanner = () =>
<div style={{
  position: 'absolute', top: 0, left: 0, right: 0,
  background: '#fef3c7',
  borderBottom: '1.6px solid #f59e0b',
  padding: '6px 16px',
  display: 'flex', alignItems: 'center', gap: 10,
  fontSize: 13,
  zIndex: 4
}}>
    <Avatar initials="D" tone="grn" size={20} />
    <span>
      <strong>동현</strong>의 시점 따라가는 중
      <span style={{ color: 'var(--ink-soft)' }}> · API 명세서 페이지</span>
    </span>
    <span style={{ flex: 1 }} />
    <span className="tag" style={{ background: 'var(--paper)', fontSize: 11 }}>⏸ 일시 중지</span>
    <span className="tag" style={{ background: 'var(--paper)', fontSize: 11 }}>그만 따라가기</span>
  </div>;


// Read-only hint badge for follower
const ReadOnlyHint = () =>
<div style={{
  position: 'absolute', bottom: 28, left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(28,27,26,0.85)',
  color: '#fff',
  padding: '5px 12px',
  borderRadius: 999,
  fontSize: 11,
  display: 'inline-flex', alignItems: 'center', gap: 6,
  zIndex: 35,
  backdropFilter: 'blur(2px)'
}}>
    <span>🔒</span>
    <span>발표자의 시점을 따라가는 중 — 편집은 잠시 비활성</span>
  </div>;


const VariantFollower = () =>
<div className="shell">
    <TitleBar
    activeIdx={1}
    tabs={[
    { name: 'Capde Draft' },
    { name: 'API 명세서' }]
    } />
  
    <TopNavbar
    breadcrumb={['초안', 'API 명세서']}
    avatars={[
    { initials: 'M', tone: 'sky', you: true },
    { initials: 'J', tone: 'yel' },
    { initials: 'S', tone: 'pnk' },
    { initials: 'D', tone: 'grn' }]
    } />
  
    <div className="row grow" style={{ flex: '1 1 auto', minHeight: 0, position: 'relative' }}>
      <LeftSidebarExpanded active="API 명세서" />
      <div className="grow" style={{ position: 'relative', overflow: 'hidden', background: 'var(--paper)' }}>
        <FollowerBanner />
        <div style={{ paddingTop: 30, height: '100%' }}>
          <EditorBody withRemoteCursors />
        </div>
        {/* Same marks the presenter drew — visible read-only */}
        <DrawingMarks />
        {/* Presenter's laser pointer */}
        <LaserPointer x={460} y={340} />
        <ReadOnlyHint />
        <FloatingTOC active={2} />
      </div>
    </div>
    <BottomStatusBar />
  </div>;


// =============== Multi-presenter focus tab close-up ===============
const MultiFocusGrid = () => {
  const sessions = [
  { presenter: '동현', presenterTone: 'grn', page: 'API 명세서', joined: true, time: '04:21',
    followers: [{ initials: 'M', tone: 'sky' }, { initials: 'J', tone: 'yel' }, { initials: 'S', tone: 'pnk' }] },
  { presenter: '소영', presenterTone: 'pnk', page: '회의록 05-25', joined: false, time: '01:08',
    followers: [{ initials: 'J', tone: 'yel' }] },
  { presenter: '재훈', presenterTone: 'yel', page: '리서치 / 대조군', joined: false, time: '00:42',
    followers: [] },
  { presenter: '나', presenterTone: 'sky', page: 'Capde Draft', joined: false, time: '00:18',
    followers: [], isMe: true }];

  return (
    <div style={{
      width: '100%', height: '100%',
      padding: '28px',
      background: 'var(--paper-2)',
      display: 'flex', gap: 28,
      fontFamily: 'var(--hand)'
    }}>
      {/* Left: enlarged chat panel showing focus tab */}
      <div style={{
        width: 420, flex: '0 0 auto',
        display: 'flex', flexDirection: 'column',
        background: 'var(--paper)',
        border: '1.6px solid var(--line)',
        borderRadius: 8,
        boxShadow: '0 8px 22px rgba(28,27,26,0.10)',
        height: 'fit-content',
        maxHeight: '100%'
      }}>
        {/* Tab strip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px',
          borderBottom: '1.2px solid var(--line)',
          background: 'var(--paper-2)',
          borderTopLeftRadius: 8, borderTopRightRadius: 8
        }}>
          <span style={{ fontSize: 14 }}>💬</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <ChatTab label="채팅" />
            <ChatTab label="포커스 팔로잉" active live />
            <ChatTab label="파일" count="·3" />
          </div>
        </div>
        <FocusTabPane sessions={sessions} />
      </div>
      {/* Right: annotations */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>다중 발표자 보여주기
</div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 4, maxWidth: 480, lineHeight: 1.5 }}>
            여러 명이 동시에 시점을 공유해도 race condition 없음. 각 세션은 독립적이고,
            참여자는 원하는 세션에만 합류한다.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 460 }}>
          {[{ t: '정사각 카드 그리드', d: '2열 그리드, 카드 1:1 비율. 4명이 동시에 켜도 한눈에 보임.' },
          { t: 'LIVE 상태 = 파란색', d: 'sky-deep + 옅은 글로우로 펄스. 빨간색은 위험/오류와 혼동되어 피함.' },
          { t: '참여 / 참여 중 / 중단 — 단일 CTA', d: '본인 세션은 ⏹ 중단, 참여 중인 세션은 sky-soft 배지, 미참여 세션은 sky-fill "참여".' },
          { t: '최근 활동 로그 제거', d: '협업 흐름에서 과거 세션 정보가 시각 노이즈를 발생시킴. 필요하면 별도 history 진입점으로 분리.' }].
          map((it, i) =>
          <div key={i} style={{
            padding: '8px 12px',
            background: 'var(--paper)',
            border: '1.2px solid var(--line)',
            borderRadius: 6,
            display: 'flex', gap: 10, alignItems: 'flex-start'
          }}>
              <span style={{
              width: 22, height: 22, flex: '0 0 auto',
              background: 'var(--sky)', color: '#fff',
              borderRadius: '50%',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700
            }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{it.t}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 1, lineHeight: 1.45 }}>{it.d}</div>
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: '10px 14px',
          background: 'var(--warm-yellow)',
          border: '1.2px solid var(--line)',
          borderRadius: 6,
          fontSize: 12.5,
          maxWidth: 460,
          lineHeight: 1.45,
          transform: 'rotate(-0.4deg)',
          boxShadow: '2px 2px 0 rgba(28,27,26,0.1)'
        }}>
          <strong>참고:</strong> 카드가 5개 이상이면 세로 스크롤. 무한히 늘어나지 않도록 8개 초과 시 "...외 N개 보기" 펼침으로 가드.
        </div>
      </div>
    </div>);

};

Object.assign(window, {
  PresenterBanner, PenToolbar, DrawingMarks,
  VariantPresenter, VariantFollower,
  FollowerBanner, ReadOnlyHint, MultiFocusGrid, FocusSessionCard
});


// Mount DesignCanvas with four variants.

const { useEffect } = React;

const Card = ({ children }) =>
<div style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
    {children}
  </div>;


const App = () =>
<DesignCanvas>
    <DCSection
    id="app-shell"
    title="App Shell — 메인 화면"
    subtitle="네 가지 상태 · 라이트 테마 · sky-blue primary">
    
      <DCArtboard
      id="v1-default"
      label="V1 · 기본 진입"
      width={SHELL_W}
      height={SHELL_H}>
      
        <Card><VariantDefault /></Card>
      </DCArtboard>

      <DCArtboard
      id="v2-focus"
      label="V2 · 집중 모드 · 사이드바 접힘 + 채팅 floating"
      width={SHELL_W}
      height={SHELL_H}>
      
        <Card><VariantFocus /></Card>
      </DCArtboard>

      <DCArtboard
      id="v3-collab"
      label="V3 · 협업 활성 · 포커스 팔로잉 + 블록 플로팅"
      width={SHELL_W}
      height={SHELL_H}>
      
        <Card><VariantCollab /></Card>
      </DCArtboard>

      <DCArtboard
      id="v4-chat"
      label="V4 · 채팅 탭 (drawer 50% 너비, 우하단)"
      width={SHELL_W}
      height={SHELL_H}>
      
        <Card><VariantChatDrawer tab="chat" /></Card>
      </DCArtboard>

      <DCArtboard
      id="v4-focus"
      label="V4 · 포커스 팔로잉 탭 — 진입점·세션·로그 통합"
      width={SHELL_W}
      height={SHELL_H}>
      
        <Card><VariantChatDrawer tab="focus" /></Card>
      </DCArtboard>

      <DCArtboard
      id="v4-files"
      label="V4 · 파일 탭 — 공유된 파일만 정리"
      width={SHELL_W}
      height={SHELL_H}>
      
        <Card><VariantChatDrawer tab="files" /></Card>
      </DCArtboard>
    </DCSection>

    <DCSection
    id="docking-study"
    title="채팅탭 위치 - B로 결정"
    subtitle="A · 전체너비  vs  B · 우하단 50% resize ✓  vs  C · 우측 패널">
    
      <DCArtboard
      id="docking-cmp"
      label="채팅 docked 위치 — 세 가지 옵션 검토"
      width={1280}
      height={760}>
      
        <Card><DockingComparison /></Card>
      </DCArtboard>
    </DCSection>

    <DCSection
    id="editor-detail"
    title="Editor main + 블록 플로팅"
    subtitle="live preview + block, 블록 플로팅 최대 3개(?)">
    
      <DCArtboard id="ed-1" label="① 기본 — 모든 블록 렌더링" width={960} height={680}>
        <Card><EditorAB1 /></Card>
      </DCArtboard>
      <DCArtboard id="ed-2" label="② 블록 호버 — 거터 핸들 노출" width={960} height={680}>
        <Card><EditorAB2 /></Card>
      </DCArtboard>
      <DCArtboard id="ed-3" label="③ Live Preview — 커서 in 헤딩" width={960} height={680}>
        <Card><EditorAB3 /></Card>
      </DCArtboard>
      <DCArtboard id="ed-4" label="④ Live Preview — 커서 in 단락 (인라인 마크 노출)" width={960} height={680}>
        <Card><EditorAB4 /></Card>
      </DCArtboard>
      <DCArtboard id="ed-5" label="⑤ 슬래시 메뉴 — 블록 추가" width={960} height={680}>
        <Card><EditorAB5 /></Card>
      </DCArtboard>
      <DCArtboard id="ed-6" label="⑥ 우클릭 컨텍스트 메뉴 (AI 제외 · 플로팅 강조)" width={960} height={680}>
        <Card><EditorAB6 /></Card>
      </DCArtboard>
      <DCArtboard id="ed-7" label="⑦ 플로팅으로 띄우기 — 미러된 창 등장" width={960} height={680}>
        <Card><EditorAB7 /></Card>
      </DCArtboard>
      <DCArtboard id="ed-8" label="⑧ Edge · 최대 3개 도달 — 메뉴 disable + 툴팁" width={960} height={680}>
        <Card><EditorAB8 /></Card>
      </DCArtboard>
      <DCArtboard id="ed-9" label="⑨ Edge · 원본 삭제됨 — 미러 경고 상태" width={960} height={680}>
        <Card><EditorAB9 /></Card>
      </DCArtboard>
    </DCSection>

    <DCSection
    id="file-viewer"
    title="인앱 파일 뷰어 (UC-080)"
    subtitle="문서에 임베드된 PDF를 외부 프로그램 없이 인앱으로 미리보기, 메뉴로 펼침/접힘 토글">
    
      <DCArtboard id="fv-1" label="① 미리보기 펼침 — PDF 인앱 렌더링 (기본)" width={960} height={720}>
        <Card><FileViewerAB1 /></Card>
      </DCArtboard>
      <DCArtboard id="fv-2" label="② ⋮ 메뉴 — 미리보기 접기 토글" width={960} height={720}>
        <Card><FileViewerAB2 /></Card>
      </DCArtboard>
      <DCArtboard id="fv-3" label="③ 미리보기 접힘 — 컴팩트 파일 칩" width={960} height={720}>
        <Card><FileViewerAB3 /></Card>
      </DCArtboard>
    </DCSection>

    <DCSection
    id="focus-following"
    title="포커스 팔로잉"
    subtitle="발표자 시점에 그리기 도구 제공, 참여자는 같은 위치를 읽기 전용으로 본다.">
    
      <DCArtboard id="ff-presenter" label="① 발표자 — 펜 도구 + 본인 그린 마크 + 'N명 따라보는 중'" width={SHELL_W} height={SHELL_H}>
        <Card><VariantPresenter /></Card>
      </DCArtboard>
      <DCArtboard id="ff-follower" label="② 참여자 — 따라가는 중 배너 + 발표자 마크 (읽기 전용)" width={SHELL_W} height={SHELL_H}>
        <Card><VariantFollower /></Card>
      </DCArtboard>
      <DCArtboard id="ff-multi" label="③ 다중 발표 — 포커스 팔로잉 탭의 정사각 카드 그리드" width={1280} height={760}>
        <Card><MultiFocusGrid /></Card>
      </DCArtboard>
    </DCSection>
  </DesignCanvas>;


ReactDOM.createRoot(document.getElementById('root')).render(<App />);