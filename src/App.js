import React, { useState, useEffect } from "react";
import "./App.scss";
import thunk from "redux-thunk";
import { createStore, combineReducers, applyMiddleware } from "redux";
import { Provider, connect } from "react-redux";
import { Router, Route, Link, Redirect, Switch } from "react-router-dom";
import createHistory from "history/createBrowserHistory";
const history = createHistory();

const actionPending = (name) => ({ type: "PROMISE", status: "PENDING", name });
const actionResolved = (name, payload) => ({
  type: "PROMISE",
  status: "RESOLVED",
  name,
  payload,
});
const actionRejected = (name, error) => ({
  type: "PROMISE",
  status: "REJECTED",
  name,
  error,
});

const actionPromise = (name, promise) => async (dispatch) => {
  dispatch(actionPending(name)); // 1. {delay1000: {status: 'PENDING'}}
  try {
    let payload = await promise;
    dispatch(actionResolved(name, payload));
    return payload;
  } catch (error) {
    dispatch(actionRejected(name, error));
  }
};

const getGQL =
  (url) =>
  (query, variables = {}) =>
    fetch(url, {
      //метод
      method: "POST",
      headers: {
        //заголовок content-type
        "Content-Type": "application/json",
        ...(localStorage.authToken
          ? { Authorization: "Bearer " + localStorage.authToken }
          : {}),
      },
      //body с ключами query и variables
      body: JSON.stringify({ query, variables }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.errors && !data.data)
          throw new Error(JSON.stringify(data.errors));
        return data.data[Object.keys(data.data)[0]];
      });

const backURL = "http://shop-roles.node.ed.asmer.org.ua/graphql";
const gql = getGQL(backURL + "/graphql");

function jwtDecode(token) {
  try {
    let decoded = token.split(".");
    decoded = decoded[1];
    decoded = atob(decoded);
    decoded = JSON.parse(decoded);
    return decoded;
  } catch (e) {
    return;
  }
}

const actionRootCats = () =>
  actionPromise(
    "rootCats",
    gql(`query {
        CategoryFind(query: "[{\\"parent\\":null}]"){
            _id name
        }
    }`)
  );

const actionCartAdd = (good, count = 1) => ({ type: "CART_ADD", good, count });
const actionCartRemove = (good, count = 1) => ({
  type: "CART_REMOVE",
  good,
  count,
});
const actionCartChange = (good, count = 1) => ({
  type: "CART_CHANGE",
  good,
  count,
});
const actionCartClear = (good, count = 1) => ({
  type: "CART_CLEAR",
  good,
  count,
});

function cartReducer(state = {}, { type, good = {}, count = 1 }) {
  const { _id } = good;
  const types = {
    CART_ADD() {
      return {
        ...state,
        [_id]: { good, count: count + (state[_id]?.count || 0) },
      };
    },
    CART_REMOVE() {
      let newState = { ...state };
      delete newState[_id];
      return {
        ...newState,
      };
    },
    CART_CHANGE() {
      return {
        ...state,
        [_id]: { good, count },
      };
    },
    CART_CLEAR() {
      return {};
    },
  };

  if (type in types) return types[type]();

  return state;
}

function authReducer(state, { type, token }) {
  if (!state) {
    if (localStorage.authToken) {
      type = "AUTH_LOGIN";
      token = localStorage.authToken;
    } else {
      return {};
    }
  }
  if (type === "AUTH_LOGIN") {
    let auth = jwtDecode(token);
    if (auth) {
      localStorage.authToken = token;
      return { token, payload: auth };
    }
  }
  if (type === "AUTH_LOGOUT") {
    localStorage.removeItem("authToken");
    return {};
  }

  return state;
}

function promiseReducer(state = {}, { type, name, status, payload, error }) {
  if (type === "PROMISE") {
    return {
      ...state,
      [name]: { status, payload, error },
    };
  }
  return state;
}

const actionAuthLogin = (token) => ({ type: "AUTH_LOGIN", token });
const actionAuthLogout = () => ({ type: "AUTH_LOGOUT" });

const actionLogin = (login = "tst", password = "123") =>
  actionPromise(
    "login",
    gql(
      `query ($login:String, $password:String){ login(login:$login, password:$password)}`,
      { login: login, password: password }
    )
  );

const actionFullLogin =
  (login = "tst", password = "123") =>
  async (dispatch) => {
    let token = await dispatch(actionLogin(login, password));
    if (token) {
      dispatch(actionAuthLogin(token));
    }
  };

const actionRegister = (login = "tst", password = "123") =>
  actionPromise(
    "login",
    gql(
      `mutation reg($login:String, $password:String) {
        UserUpsert(user:{login:$login, password:$password, nick:$login}){
          _id login
        }
      }`,
      { login: login, password: password }
    )
  );

const actionFullRegister =
  (login = "tst", password = "123") =>
  async (dispatch) => {
    await dispatch(actionRegister(login, password));
    await dispatch(actionFullLogin(login, password));
  };

const actionCatById = (_id) =>
  actionPromise(
    "catById",
    gql(
      `query ($q: String){
        CategoryFindOne(query: $q){
            _id name goods {
                _id name price images {
                    url
                }
            } 
            subCategories {
                _id name
            }
        }
    }`,
      { q: JSON.stringify([{ _id }]) }
    )
  );

const actionGoodById = (_id) =>
  actionPromise(
    "goodById",
    gql(
      `query ($good:String) {
        GoodFindOne(query:$good) {
          _id name price description images {
              url
          }
        }
      }`,
      { good: JSON.stringify([{ _id }]) }
    )
  );

const store = createStore(
  combineReducers({
    promise: promiseReducer,
    auth: authReducer,
    cart: cartReducer,
  }),
  applyMiddleware(thunk)
);
store.subscribe(() => console.log(store.getState()));
store.dispatch(actionRootCats());
store.dispatch(actionCatById("5dc458985df9d670df48cc47"));

const Header = ({ loggedIn, nick, logout }) => {
  if (loggedIn) {
    return (
      <header>
        <p>{nick}</p>
        <button onClick={() => logout()}>Logout</button>
        <Link to="/cart">Cart</Link>
      </header>
    );
  } else {
    return (
      <header>
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
        <Link to="/cart">Cart</Link>
      </header>
    );
  }
};

const CHeader = connect(
  (store) => ({
    loggedIn: store.auth.token,
    nick: store.auth.payload?.sub?.login,
  }),
  { logout: actionAuthLogout }
)(Header);

const Login = ({ actionLogin, loggedIn }) => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div>
      <h2>Авторизация</h2>
      {login === "" ? (
        <input
          style={{ backgroundColor: "#FF6347" }}
          placeholder={"login"}
          onChange={(e) => setLogin(e.target.value)}
        />
      ) : (
        <input
          value={login}
          placeholder={"login"}
          onChange={(e) => setLogin(e.target.value)}
        />
      )}
      {password === "" ? (
        <input
          style={{ backgroundColor: "#FF6347" }}
          placeholder={"password"}
          onChange={(e) => setPassword(e.target.value)}
        />
      ) : (
        <input
          value={password}
          placeholder={"password"}
          onChange={(e) => setPassword(e.target.value)}
        />
      )}
      <button
        disabled={login === "" || password === ""}
        onClick={() => {
          login && password && actionLogin(login, password);
        }}
      >
        Авторизация
      </button>
      {loggedIn && <Redirect from="/login" to="/" />}
    </div>
  );
};
const CLogin = connect((store) => ({ loggedIn: store.auth.token }), {
  actionLogin: actionFullLogin,
})(Login);

const Register = ({ actionRegister, loggedIn }) => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div>
      <h3>Регистрация</h3>
      {login === "" ? (
        <input
          style={{ backgroundColor: "#FF6347" }}
          placeholder={"login"}
          onChange={(e) => setLogin(e.target.value)}
        />
      ) : (
        <input
          value={login}
          placeholder={"login"}
          onChange={(e) => setLogin(e.target.value)}
        />
      )}
      {password === "" ? (
        <input
          style={{ backgroundColor: "#FF6347" }}
          placeholder={"password"}
          onChange={(e) => setPassword(e.target.value)}
        />
      ) : (
        <input
          value={password}
          placeholder={"password"}
          onChange={(e) => setPassword(e.target.value)}
        />
      )}
      <button
        disabled={login === "" || password === ""}
        onClick={() => {
          login && password && actionRegister(login, password);
        }}
      >
        Регистрация
      </button>
      {loggedIn && <Redirect from="/register" to="/" />}
    </div>
  );
};

const CRegister = connect((store) => ({ loggedIn: store.auth.token }), {
  actionRegister: actionFullRegister,
})(Register);

//CategoryList
const CategoryLink = ({ _id, name }) => {
  return (
    <h5>
      <Link to={`/category/${_id}`}>{name}</Link>
    </h5>
  );
};

const CategoryLinks = ({ cats }) => (
  <aside>
    {cats.map((item) => (
      <CategoryLink {...item} />
    ))}
  </aside>
);
const CCategoryLinks = connect((state) => ({
  cats: state.promise.rootCats?.payload || [],
}))(CategoryLinks);

//Category
const Category = ({ cat: { name, goods = [] } = {} }) => {
  return (
    <div className="Category">
      <h2>{name}</h2>
      <ul>
        {(goods || []).map((good) => (
          <CGoodCard good={good} />
        ))}
      </ul>
    </div>
  );
};

const CCategory = connect((state) => ({
  cat: state.promise.catById?.payload,
}))(Category);

//SubCategories
const SubCategories = ({ subCats }) => {
  return (
    <div>
      {(subCats || []).map((item) => (
        <Link to={`/category/${item._id}`}>{item.name}</Link>
      ))}
    </div>
  );
};

const CSubCategories = connect((state) => ({
  subCats: state.promise.catById.payload?.subCategories,
}))(SubCategories);

//PageCategory
const PageCategory = ({
  match: {
    params: { _id },
  },
  getData,
}) => {
  useEffect(() => {
    getData(_id);
  }, [_id, getData]);
  return (
    <>
      <CCategory />
      <CSubCategories />
    </>
  );
};

const CPageCategory = connect(null, { getData: actionCatById })(PageCategory);

//Good
const GoodCard = ({ good: { _id, name, price, images }, onAdd }) => (
  <div>
    <h3>{name}</h3>
    {images && images[0] && images[0].url && (
      <img src={backURL + "/" + images[0].url} alt="" />
    )}
    <br />
    <strong>Цена: {price} USD</strong>
    <br />
    <button onClick={() => onAdd({ _id, name, price, images })}>
      В корзину
    </button>
    <br />
    <Link to={`/good/${_id}`}>Подробнее</Link>
  </div>
);

const CGoodCard = connect(null, { onAdd: actionCartAdd })(GoodCard);

const PageGood = ({
  match: {
    params: { _id },
  },
  getData,
}) => {
  useEffect(() => {
    getData(_id);
  }, [_id,getData]);
  return <CGood />;
};

const CPageGood = connect(null, { getData: actionGoodById })(PageGood);

const Good = ({ good: { _id, name, price, images, description }, onAdd }) => (
  <div>
    <h3>{name}</h3>
    {images && images[0] && images[0].url && (
      <img src={backURL + "/" + images[0].url} alt="" />
    )}
    <p>{description}</p>
    <br />
    <strong>Цена: {price} USD</strong>
    <br />
    <button onClick={() => onAdd({ _id, name, price, images })}>
      Добавить в корзину
    </button>
  </div>
);

const CGood = connect(
  (state) => ({ good: state.promise.goodById?.payload || {} }),
  { onAdd: actionCartAdd }
)(Good);

//Koshik
const CartGood = ({
  item: {
    count,
    good: { _id, name, price, images },
  },
  onCartChange,
  onCartRemove,
  onCartAdd,
}) => (
  <div>
    <h3>{name}</h3>
    {images && images[0] && images[0].url && (
      <img src={backURL + "/" + images[0].url} alt="" />
    )}
    {count < 0 ? (
      <input
        onInput={(e) =>
          onCartAdd({ _id, name, price, images }, e.currentTarget.value)
        }
        value={0}
        type="number"
      />
    ) : (
      <input
        onInput={(e) =>
          onCartChange({ _id, name, price, images }, e.currentTarget.value)
        }
        value={count}
        type="number"
      />
    )}
    <button onClick={() => onCartRemove({ _id, name, price, images })}>
      Удалить
    </button>
  </div>
);
const CCartGood = connect(null, {
  onCartChange: actionCartChange,
  onCartRemove: actionCartRemove,
  onCartAdd: actionCartAdd,
})(CartGood);

const Cart = ({ cartCount, onCartClear }) => (
  <div>
    {cartCount.map((item) => (
      <CCartGood item={item} />
    ))}
    {cartCount.length === 0 ? (
      <></>
    ) : (
      <button onClick={() => onCartClear()}>Очистить корзину</button>
    )}
  </div>
);

const CCart = connect(
  (state) => ({ cartCount: Object.values(state.cart) || [] }),
  { onCartClear: actionCartClear }
)(Cart);

const Content = ({ children }) => <div className="Content">{children}</div>;

// const Page404 = () => <h1> 404 </h1>

const Main = () => (
  <main className="mainContent">
    <CCategoryLinks />
    <Content>
      <Switch>
        <Redirect from="/main" to="/" />
        <Route path="/category/:_id" component={CPageCategory} />
        <Route path="/cart" component={CCart} />
        <Route path="/good/:_id" component={CPageGood} />
        <Route path="/login" component={CLogin} />
        <Route path="/register" component={CRegister} />
        {/* <Route path="*" component={Page404} /> */}
      </Switch>
    </Content>
  </main>
);

function App() {
  return (
    <Router history={history}>
      <Provider store={store}>
        <div className="App">
          <CHeader />
          <Main />
        </div>
      </Provider>
    </Router>
  );
}

export default App;
