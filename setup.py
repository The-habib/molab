from setuptools import setup, find_packages

setup(
    name="molab",
    version="1.0.0",
    packages=find_packages(),
    py_modules=["cli", "run_control_plane"],
    entry_points={
        "console_scripts": [
            "molab=cli:main",
            "cloudpc=cli:main",
        ],
    },
)
