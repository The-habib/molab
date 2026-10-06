# Contributing to MoLab

Thank you for your interest in contributing to **MoLab**! We welcome contributions from developers, researchers, and system administrators worldwide.

---

## 🛠️ Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/The-habib/molab.git
cd molab
```

### 2. Set Up a Python Virtual Environment
```bash
python -m venv .venv

# On Linux / macOS:
source .venv/bin/activate

# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
pip install -e .
```

### 4. Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
```
Edit `.env` to set your desired `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `AGENT_AUTH_TOKEN`.

---

## 🧪 Testing

Run unit and integration tests using pytest:
```bash
pytest tests/ -v
```

All 12 tests should pass before opening a pull request.

---

## 🎨 Frontend Development (Optional)

The prebuilt React frontend is located in `frontend/dist` and works out of the box. If you wish to modify the web interface:

```bash
cd frontend
npm install
npm run dev      # Local Vite hot-reloading dev server on :5173
npm run build    # Compile production bundle into frontend/dist
```

---

## 📋 Pull Request Guidelines

1. **Branch Naming**: Use descriptive branch names like `feature/gpu-graph-v2` or `fix/pty-buffer-overflow`.
2. **Commit Messages**: Follow standard conventional commits format (`feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`).
3. **Tests**: Ensure all existing tests pass and add new test cases for added features or bug fixes.
4. **Security**: **Never** commit API tokens, passwords, private keys, or `.env` files.

---

## 📜 License

By contributing to MoLab, you agree that your contributions will be licensed under the [MIT License](LICENSE).
